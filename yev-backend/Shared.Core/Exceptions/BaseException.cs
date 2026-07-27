namespace Shared.Core.Exceptions
{
    public abstract class BaseException : Exception
    {
        public int StatusCode { get; }
        public List<string>? Errors { get; }

        protected BaseException(string message, int statusCode, List<string>? errors = null)
            : base(message)
        {
            StatusCode = statusCode;
            Errors = errors;
        }
    }
}
