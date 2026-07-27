using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;

namespace Identity.Application.Interfaces.Service
{
    public interface ITokenService
    {
        string GenerateJwtToken(ClaimsPrincipal user);
    }
}
