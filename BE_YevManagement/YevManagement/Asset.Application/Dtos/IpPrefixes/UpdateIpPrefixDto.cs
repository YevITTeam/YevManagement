using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpPrefixes
{
    public class UpdateIpPrefixDto
    {
        public int Id { get; set; }

        public string? SubnetMask { get; set; }

        public string? Gateway { get; set; }

        public string? PreferredDns { get; set; }

        public string? AlternateDns { get; set; }

        public string? Description { get; set; }
    }
}
