using Identity.Application.Authentication;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;

namespace Identity.Infrastructure.Authentication
{
    // In-process cache (single API instance). Entries expire after Ttl; InvalidateAll cancels the shared
    // change token so every entry is evicted at once.
    public class AuthSnapshotCache : IAuthSnapshotCache
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);
        private const string KeyPrefix = "AuthSnapshot:";

        private readonly IMemoryCache _memoryCache;
        private readonly object _gate = new();
        private CancellationTokenSource _generation = new();

        public AuthSnapshotCache(IMemoryCache memoryCache)
        {
            _memoryCache = memoryCache;
        }

        public bool TryGet(string userName, out AuthSnapshot snapshot)
        {
            if (_memoryCache.TryGetValue(KeyPrefix + userName.ToLowerInvariant(), out AuthSnapshot? cached) && cached != null)
            {
                snapshot = cached;
                return true;
            }

            snapshot = null!;
            return false;
        }

        public void Set(string userName, AuthSnapshot snapshot)
        {
            CancellationToken token;
            lock (_gate) token = _generation.Token;

            var options = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(Ttl)
                .AddExpirationToken(new CancellationChangeToken(token));
            _memoryCache.Set(KeyPrefix + userName.ToLowerInvariant(), snapshot, options);
        }

        public void InvalidateAll()
        {
            CancellationTokenSource old;
            lock (_gate)
            {
                old = _generation;
                _generation = new CancellationTokenSource();
            }

            old.Cancel();
            old.Dispose();
        }
    }
}
