using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpPrefixes
{
    // Does not include Prefix — the 3-octet identifier already has its 255 child IpAddresses
    // generated based on this value, so changing the Prefix still requires deleting and
    // recreating the range (keeping the previous decision). Update only allows editing the
    // Branch + network config (SubnetMask/Gateway/DNS/Description) when there's an actual
    // change, instead of having to delete and recreate the whole range (which would lose all
    // child IpAddresses already assigned to devices).
    public class UpdateIpPrefixDto
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Chi nhánh không được để trống")]
        public int BranchId { get; set; }

        public string? SubnetMask { get; set; }

        public string? Gateway { get; set; }

        public string? PreferredDns { get; set; }

        public string? AlternateDns { get; set; }

        public string? Description { get; set; }
    }
}
