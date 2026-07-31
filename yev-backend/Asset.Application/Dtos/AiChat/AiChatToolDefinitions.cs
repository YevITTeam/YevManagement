using System.Text.Json.Nodes;

namespace Asset.Application.Dtos.AiChat
{
    // The tool catalogue sent as Ollama's `tools` field (docs/ai-chat-be-huong-dan.md §5).
    //
    // 2026-07-30 — trimmed from 17 tools to 7 and refocused on the 2 things this chat is actually used
    // for: looking a device up by any field the Device grid UI offers, and answering IP questions (which
    // IPs are free, is this IP usable, who is using it, what is free inside a given range).
    //
    // Trimming is a performance fix, not cosmetics: this catalogue is re-sent and re-evaluated on EVERY
    // turn, and measurements on the CPU-only Ollama box (`size_vram: 0`) showed prompt-eval of the old
    // ~1900-token 17-tool schema dominating latency at ~31s cold / ~17-18s warm — far more than
    // generation itself. Fewer tools also measurably reduces wrong-tool picks by a small local model.
    //
    // Removed (executor cases in AiChatToolExecutorService are intentionally LEFT IN PLACE so restoring
    // any of these is a paste of its JSON block back here, nothing more): get_device_transfer_history,
    // get_device_change_history, search_device_types, search_software, search_software_groups,
    // search_branches, search_suppliers, get_device_report, get_asset_settings, search_audit_trail.
    //
    // Keep in sync with AiChatToolExecutorService.ExecuteAsync — every name below must have a case there.
    public static class AiChatToolDefinitions
    {
        private const string ToolsJson = """
        [
          {
            "type": "function",
            "function": {
              "name": "search_devices",
              "description": "Tra cứu DANH SÁCH thiết bị (PC) theo BẤT KỲ tiêu chí nào: mã thiết bị, người quản lý, IP, email, nhà cung cấp, số serial, ghi chú, ngày mua, CHI NHÁNH, nhóm thiết bị, bộ phận, trạng thái, máy thuê ngoài hay không, có dùng USB hay không. Kết hợp được nhiều tiêu chí cùng lúc. QUAN TRỌNG: với chi nhánh/nhóm/bộ phận, hãy truyền THẲNG TÊN người dùng nói vào branchName/groupName/departmentName — KHÔNG cần và KHÔNG được gọi tool khác để đổi tên thành id trước, hệ thống tự khớp theo tên. Trả về tối đa 10 kết quả gần đúng nhất.",
              "parameters": {
                "type": "object",
                "properties": {
                  "deviceCode": { "type": "string", "description": "Mã thiết bị (tìm gần đúng)" },
                  "manager": { "type": "string", "description": "Tên người quản lý/đang sử dụng thiết bị" },
                  "ipAddress": { "type": "string", "description": "Địa chỉ IP của thiết bị" },
                  "email": { "type": "string", "description": "Email gắn với thiết bị" },
                  "supplierName": { "type": "string", "description": "Tên nhà cung cấp (nhập thẳng tên, không cần id)" },
                  "serialNumber": { "type": "string", "description": "Số serial của thiết bị (tìm gần đúng)" },
                  "note": { "type": "string", "description": "Từ khoá trong ghi chú của thiết bị" },
                  "purchaseDate": { "type": "string", "description": "Ngày mua, định dạng yyyy-MM-dd" },
                  "branchName": { "type": "string", "description": "Tên chi nhánh, truyền thẳng tên người dùng nói (vd \"Dĩ An\", \"Củ Chi\", \"Mỹ Phước\") — khớp gần đúng, không cần id" },
                  "groupName": { "type": "string", "description": "Tên Nhóm thiết bị, truyền thẳng tên người dùng nói (vd \"Công vụ\", \"Kế toán\") — khớp gần đúng, KHÔNG cần đổi sang id trước" },
                  "departmentName": { "type": "string", "description": "Tên Bộ phận quản lý, truyền thẳng tên người dùng nói — khớp gần đúng, KHÔNG cần đổi sang id trước" },
                  "status": { "type": "integer", "description": "Trạng thái thiết bị: 0 = chờ sử dụng, 1 = đang sử dụng, 2 = chờ thanh lý, 3 = đã thanh lý" },
                  "groupId": { "type": "integer", "description": "Id Nhóm thiết bị — chỉ dùng khi đã có id sẵn; bình thường hãy dùng groupName" },
                  "departmentId": { "type": "integer", "description": "Id Bộ phận quản lý — chỉ dùng khi đã có id sẵn; bình thường hãy dùng departmentName" },
                  "isOutsourced": { "type": "boolean", "description": "true = chỉ máy thuê ngoài, false = chỉ máy của công ty, bỏ trống = cả hai" },
                  "isUseUsb": { "type": "boolean", "description": "true = chỉ máy được phép dùng USB, false = chỉ máy không được dùng USB, bỏ trống = cả hai" },
                  "sortDeviceCodeAscending": { "type": "boolean", "description": "Sắp xếp theo mã thiết bị: true = tăng dần, false = giảm dần, bỏ trống = mặc định theo ngày mua mới nhất" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_device_detail",
              "description": "Lấy THÔNG TIN CHI TIẾT đầy đủ của ĐÚNG 1 thiết bị theo mã thiết bị: thông tin chung (chi nhánh, nhà cung cấp, loại máy, nhóm/bộ phận, người quản lý, email, IP, ngày mua, hạn khấu hao, trạng thái...), cấu hình phần cứng (CPU/RAM/ổ cứng/màn hình...) và danh sách phần mềm đã cài. Dùng khi đã biết chính xác mã thiết bị và cần biết đầy đủ thông tin về máy đó.",
              "parameters": {
                "type": "object",
                "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem chi tiết" } },
                "required": ["deviceCode"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_device_groups",
              "description": "Tra cứu danh sách Nhóm thiết bị theo từ khoá tên/mã nhóm. Dùng để đổi tên Nhóm mà người dùng nói thành groupId thật trước khi gọi search_devices.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhóm" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_device_departments",
              "description": "Tra cứu danh sách Bộ phận quản lý thiết bị theo từ khoá tên/mã bộ phận. Dùng để đổi tên Bộ phận mà người dùng nói thành departmentId thật trước khi gọi search_devices.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã bộ phận" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_ip_addresses",
              "description": "Tra cứu địa chỉ IP và TÌNH TRẠNG SỬ DỤNG của chúng. Trả về mỗi IP kèm trạng thái (còn trống / đã gán) và mã thiết bị đang dùng IP đó. Dùng cho các câu hỏi: \"IP 10.45.1.20 có dùng được không\" (truyền keyword là IP đó, xem trạng thái trả về), \"IP này đang được máy nào dùng\" (xem deviceCode trong kết quả), \"còn IP nào trống\" (truyền isInUse=false), \"trong dải 10.45.1 còn IP nào trống\" (truyền keyword=\"10.45.1.\" kèm isInUse=false). Kết quả có totalCount = tổng số IP khớp điều kiện và items = tối đa 10 IP đầu, nên khi totalCount lớn hơn số IP liệt kê thì PHẢI nói rõ tổng số cho người dùng biết. MỌI tham số đều không bắt buộc: nếu người dùng hỏi chung \"còn IP nào trống\" mà không nêu dải mạng nào, PHẢI gọi ngay tool này với isInUse=false, TUYỆT ĐỐI không hỏi lại người dùng muốn tìm trong dải nào.",
              "parameters": {
                "type": "object",
                "properties": {
                  "keyword": { "type": "string", "description": "Địa chỉ IP cần tra, hoặc tiền tố dải mạng (vd \"10.45.1.\") để lọc mọi IP trong dải, hoặc từ khoá trong ghi chú" },
                  "isInUse": { "type": "boolean", "description": "false = CHỈ lấy IP còn trống (chưa gán cho máy nào), true = CHỈ lấy IP đang được sử dụng, bỏ trống = lấy cả hai" },
                  "status": { "type": "integer", "description": "Lọc chính xác theo trạng thái: 0 = còn trống, 1 = đã gán cho thiết bị NGOÀI hệ thống, 2 = đã gán cho thiết bị trong hệ thống. Thường chỉ cần dùng isInUse là đủ" },
                  "deviceCode": { "type": "string", "description": "Mã thiết bị — dùng khi muốn biết 1 máy cụ thể đang được gán những IP nào" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_ip_prefix_usage",
              "description": "Lấy tình trạng sử dụng của TOÀN BỘ 1 dải mạng (IP prefix, dạng 3 octet vd \"10.45.1\"): IP nào đang được gán cho thiết bị nào, IP nào còn trống, kèm TỔNG SỐ IP đã dùng và còn trống của cả dải (tổng số được tính trên toàn dải trước khi cắt bớt danh sách, nên luôn chính xác). Ưu tiên dùng tool này khi người dùng hỏi tổng quan về 1 dải mạng; muốn tra 1 IP cụ thể thì dùng search_ip_addresses.",
              "parameters": {
                "type": "object",
                "properties": { "prefix": { "type": "string", "description": "Dải mạng 3 octet cần tra cứu, vd \"10.45.1\"" } },
                "required": ["prefix"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_ip_prefixes",
              "description": "Tra cứu danh sách các dải mạng (subnet/IP prefix) đang có trong hệ thống — gồm chi nhánh sở hữu, subnet mask, gateway, DNS, số IP đã dùng/còn trống trong dải. Dùng khi người dùng hỏi \"hệ thống có những dải mạng nào\", hoặc khi cần biết tên dải trước khi gọi get_ip_prefix_usage.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá dải mạng hoặc mô tả" } },
                "required": []
              }
            }
          }
        ]
        """;

        // Parsed once at startup. JsonNode is single-parent (cannot be attached to 2 different
        // JsonObjects at once) — callers MUST DeepClone() this before inserting it into a request body.
        public static readonly JsonNode Tools = JsonNode.Parse(ToolsJson)!;
    }
}
