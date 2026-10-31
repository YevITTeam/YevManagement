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

        /// <summary>
        /// Rejects a business code that is already taken, including by a soft-deleted row.
        /// </summary>
        /// <remarks>
        /// The unique indexes in this database are global: they do NOT filter on IsDeleted, so a
        /// soft-deleted row keeps occupying its code forever. Callers must therefore look the code
        /// up WITHOUT an <c>IsDeleted</c> filter and pass whatever they found here. Adding
        /// <c>&amp;&amp; !x.IsDeleted</c> back to that lookup makes the check pass for a code that
        /// SQL will still reject, turning a clean 400 into a raw DbUpdateException (HTTP 500).
        ///
        /// Callers must also exclude the row being edited by id (<c>x.Id != request.Id</c>) rather
        /// than comparing the old and new code in C# first: <c>string !=</c> is ordinal
        /// case-sensitive while the SQL collation is case-insensitive, so a code changed only in
        /// letter casing would match itself and be reported as a duplicate.
        /// </remarks>
        /// <param name="existing">The conflicting row, or null when the code is free.</param>
        /// <param name="codeLabel">User-facing label of the code (shown in the message).</param>
        /// <param name="code">The requested code, echoed back in the message.</param>
        /// <param name="isSoftDeleted">Reads the IsDeleted flag off the conflicting row.</param>
        /// <param name="scopeSuffix">Optional trailing clause appended to the message, e.g. a parent-scope qualifier.</param>
        public static void ThrowIfDuplicateCode<T>(
            this T? existing,
            string codeLabel,
            string code,
            Func<T, bool> isSoftDeleted,
            string scopeSuffix = "") where T : class
        {
            if (existing is null) return;

            throw new DomainException(isSoftDeleted(existing)
                ? $"{codeLabel} '{code}' đang thuộc một bản ghi đã xóa{scopeSuffix} nên không dùng lại được."
                : $"{codeLabel} '{code}' đã tồn tại{scopeSuffix}.");
        }
    }
}
