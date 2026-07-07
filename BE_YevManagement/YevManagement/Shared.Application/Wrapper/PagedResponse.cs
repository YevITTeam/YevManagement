using System;
using System.Collections.Generic;
using System.Text;

namespace Shared.Application.Wrapper
{
    public class PagedResponse<T>
    {
        public IReadOnlyList<T> Data { get; set; }
        public int PageIndex { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasNextPage => PageIndex < TotalPages;
        public bool HasPreviousPage => PageIndex > 1;

        public PagedResponse(IReadOnlyList<T> data, int count, int pageIndex, int pageSize)
        {
            Data = data;
            PageIndex = pageIndex;
            PageSize = pageSize;
            TotalCount = count;
            TotalPages = (int)Math.Ceiling(count / (double)pageSize);
        }
    }
}
