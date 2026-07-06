using System;
using System.Collections.Generic;
using System.Text;

namespace Shared.Application.Helper
{
    public static class TimeHelper
    {
        public static DateTime GetCurrentUtcTime()
        {
            return DateTime.UtcNow.AddHours(7);
        }
    }
}
