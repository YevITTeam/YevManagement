using System;
using System.Collections.Generic;
using System.Text;

namespace Identity.Domain.Entities
{
    public class LoginUserIP
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public string IPAddress { get; set; } = null!;

        public DateTime FirstLoginAt { get; set; } = DateTime.UtcNow;

        public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;

        public virtual User User { get; set; } = null!;
    }
}
