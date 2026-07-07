using System;
using System.Collections.Generic;
using System.Text;

namespace Shared.Core.Exceptions
{
    public class DomainException : BaseException
    {
        public DomainException(string message)
            : base(message, 400) { }
    }
}
