using System;
using System.Collections.Generic;
using System.Text;

namespace Shared.Core.Exceptions
{
    public class NotFoundException : BaseException
    {
        public NotFoundException(string entityName, object key)
            : base($"{entityName} with ID ({key}) not exist.", 404) { }
    }
}
