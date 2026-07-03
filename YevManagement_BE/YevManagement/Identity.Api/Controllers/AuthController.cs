using Microsoft.AspNetCore.Mvc;

namespace Identity.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        [HttpGet("ping")]
        public IActionResult Ping()
        {
            return Ok(new
            {
                Message = "Pong! Module Identity đã kết nối thành công với HostApi.",
                Module = "Identity.Api",
                Timestamp = DateTime.UtcNow
            });
        }
    }
}
