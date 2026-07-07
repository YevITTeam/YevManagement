using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace Shared.Core.Exceptions
{
    public static class GuardExtensions
    {
        [return: NotNull]
        public static T OrThrow<T>(this T? value, string message) where T : class
        {
            if (value is null) throw new DomainException(message);
            return value;
        }

        [return: NotNull]
        public static T OrThrowNotFound<T>(this T? value, string entityName, object key) where T : class
        {
            if (value is null) throw new NotFoundException(entityName, key);
            return value;
        }
    }
}
