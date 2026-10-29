using SkiaSharp;

namespace Attendance.Application.Services
{
    // Port of yev-frontend/src/lib/signatureCutout.ts so signatures embedded in Excel get the same cut-out
    // as on-screen uploads; change both together.
    internal static class SignatureCutout
    {
        private const int MaxWidth = 800;
        private const int Padding = 8;
        private const int PaperRadius = 20;
        private const int MergeRadius = 10;
        private const int InkAlphaMin = 40;
        private const int ClusterAlphaMin = 128;
        private const int PaperFloor = 60;

        // Photo/scan of a signature -> transparent PNG cropped to the strokes. Undecodable or blank images
        // come back unchanged rather than empty.
        public static byte[] Process(byte[] image)
        {
            // SKBitmap.Decode(byte[]) throws on unknown formats; SKCodec.Create returns null instead.
            using var codec = SKCodec.Create(new SKMemoryStream(image));
            if (codec == null) return image;
            using var source = SKBitmap.Decode(codec);
            if (source == null || source.Width == 0 || source.Height == 0) return image;

            var scale = Math.Min(1.0, (double)MaxWidth / source.Width);
            var w = Math.Max(1, (int)Math.Round(source.Width * scale, MidpointRounding.AwayFromZero));
            var h = Math.Max(1, (int)Math.Round(source.Height * scale, MidpointRounding.AwayFromZero));

            using var flat = new SKBitmap(new SKImageInfo(w, h, SKColorType.Rgba8888, SKAlphaType.Premul));
            using (var canvas = new SKCanvas(flat))
            using (var sourceImage = SKImage.FromBitmap(source))
            {
                canvas.Clear(SKColors.White);
                canvas.DrawImage(sourceImage, new SKRect(0, 0, w, h), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
            }
            var px = flat.GetPixelSpan().ToArray();

            var box = CutOutPixels(px, w, h);
            if (box == null) return image;

            var (minX, minY, maxX, maxY) = box.Value;
            var sx = Math.Max(0, minX - Padding);
            var sy = Math.Max(0, minY - Padding);
            var sw = Math.Min(w, maxX + Padding + 1) - sx;
            var sh = Math.Min(h, maxY + Padding + 1) - sy;
            var crop = new byte[sw * sh * 4];
            for (var y = 0; y < sh; y++)
                Buffer.BlockCopy(px, ((sy + y) * w + sx) * 4, crop, y * sw * 4, sw * 4);

            using var output = SKImage.FromPixelCopy(new SKImageInfo(sw, sh, SKColorType.Rgba8888, SKAlphaType.Unpremul), crop);
            using var data = output.Encode(SKEncodedImageFormat.Png, 100);
            return data.ToArray();
        }

        // Rewrites RGBA in place: paper -> transparent, ink keeps its colour, only the heaviest stroke cluster survives.
        internal static (int MinX, int MinY, int MaxX, int MaxY)? CutOutPixels(byte[] px, int w, int h)
        {
            var n = w * h;
            var lum = new byte[n];
            for (var p = 0; p < n; p++)
                lum[p] = (byte)(0.299 * px[p * 4] + 0.587 * px[p * 4 + 1] + 0.114 * px[p * 4 + 2]);
            var paper = BoxBlur(MaxFilter(lum, w, h, PaperRadius), w, h, PaperRadius);

            var alpha = new byte[n];
            var ink = new byte[n];
            for (var p = 0; p < n; p++)
            {
                var ratio = (double)lum[p] / Math.Max((int)paper[p], PaperFloor);
                alpha[p] = (byte)Math.Round(Math.Clamp((0.88 - ratio) / 0.33, 0, 1) * 255, MidpointRounding.AwayFromZero);
                ink[p] = alpha[p] >= ClusterAlphaMin ? (byte)1 : (byte)0;
            }

            // Dilate strong ink so the letters of one signature form one cluster, then keep the heaviest.
            var near = MaxFilter(ink, w, h, MergeRadius);
            var label = new int[n];
            var weight = new List<long> { 0 };
            var stack = new int[n];
            var best = 0;
            for (var start = 0; start < n; start++)
            {
                if (near[start] == 0 || label[start] != 0) continue;
                var id = weight.Count;
                weight.Add(0);
                var top = 0;
                stack[top++] = start;
                label[start] = id;
                while (top > 0)
                {
                    var p = stack[--top];
                    if (ink[p] != 0) weight[id] += alpha[p];
                    var x = p % w;
                    var y = p / w;
                    for (var dy = -1; dy <= 1; dy++)
                    {
                        for (var dx = -1; dx <= 1; dx++)
                        {
                            var nx = x + dx;
                            var ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                            var q = ny * w + nx;
                            if (near[q] != 0 && label[q] == 0)
                            {
                                label[q] = id;
                                stack[top++] = q;
                            }
                        }
                    }
                }
                if (weight[id] > weight[best]) best = id;
            }
            if (best == 0) return null;

            int minX = w, minY = h, maxX = -1, maxY = -1;
            for (var p = 0; p < n; p++)
            {
                var o = p * 4;
                if (label[p] != best || alpha[p] < 5)
                {
                    px[o + 3] = 0;
                    continue;
                }
                var a = alpha[p] / 255.0;
                double bg = Math.Max((int)paper[p], PaperFloor);
                // Un-blend the ink colour from the paper so soft edges keep the pen colour.
                for (var c = 0; c < 3; c++)
                    px[o + c] = (byte)Math.Clamp(Math.Round((px[o + c] * 255 / bg - 255 * (1 - a)) / a), 0, 255);
                px[o + 3] = alpha[p];
                if (alpha[p] >= InkAlphaMin)
                {
                    var x = p % w;
                    var y = p / w;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
            return (minX, minY, maxX, maxY);
        }

        // Separable square max filter: a window wider than any stroke only sees paper, so it tracks local lighting.
        private static byte[] MaxFilter(byte[] src, int w, int h, int r)
        {
            var tmp = new byte[src.Length];
            var output = new byte[src.Length];
            for (var y = 0; y < h; y++)
            {
                for (var x = 0; x < w; x++)
                {
                    byte m = 0;
                    for (int k = Math.Max(0, x - r), end = Math.Min(w - 1, x + r); k <= end; k++) m = Math.Max(m, src[y * w + k]);
                    tmp[y * w + x] = m;
                }
            }
            for (var x = 0; x < w; x++)
            {
                for (var y = 0; y < h; y++)
                {
                    byte m = 0;
                    for (int k = Math.Max(0, y - r), end = Math.Min(h - 1, y + r); k <= end; k++) m = Math.Max(m, tmp[k * w + x]);
                    output[y * w + x] = m;
                }
            }
            return output;
        }

        private static byte[] BoxBlur(byte[] src, int w, int h, int r)
        {
            var tmp = new float[src.Length];
            var output = new byte[src.Length];
            for (var y = 0; y < h; y++)
            {
                for (var x = 0; x < w; x++)
                {
                    int a = Math.Max(0, x - r), b = Math.Min(w - 1, x + r);
                    float s = 0;
                    for (var k = a; k <= b; k++) s += src[y * w + k];
                    tmp[y * w + x] = s / (b - a + 1);
                }
            }
            for (var x = 0; x < w; x++)
            {
                for (var y = 0; y < h; y++)
                {
                    int a = Math.Max(0, y - r), b = Math.Min(h - 1, y + r);
                    float s = 0;
                    for (var k = a; k <= b; k++) s += tmp[k * w + x];
                    output[y * w + x] = (byte)Math.Round(s / (b - a + 1), MidpointRounding.AwayFromZero);
                }
            }
            return output;
        }
    }
}
