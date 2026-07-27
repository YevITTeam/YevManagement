using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Dtos.Branches
{
    public class BranchDto
    {
        public int Id { get; set; }
        public string BranchCode { get; set; } = null!;
        public string BranchName { get; set; } = null!;
    }
}
