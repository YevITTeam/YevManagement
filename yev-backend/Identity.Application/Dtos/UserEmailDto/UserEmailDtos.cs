using System.ComponentModel.DataAnnotations;

namespace Identity.Application.Dtos.UserEmailDto
{
    public class UserEmailDto
    {
        public int Id { get; set; }
        public string Email { get; set; } = null!;
        // UserEmailSource
        public int Source { get; set; }
        public bool IsPrimary { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // Module routing row: UserEmailId null = the module sends to the primary address.
    public class UserEmailModuleAssignmentDto
    {
        public string ModuleCode { get; set; } = null!;
        public string ModuleName { get; set; } = null!;
        public bool IsApplied { get; set; }
        public int? UserEmailId { get; set; }
    }

    public class UserEmailOverviewDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? FullName { get; set; }
        public List<UserEmailDto> Emails { get; set; } = new();
        public List<UserEmailModuleAssignmentDto> Modules { get; set; } = new();
    }

    public class CreateUserEmailDto
    {
        [Required(ErrorMessage = "Email là bắt buộc.")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
        [StringLength(255, ErrorMessage = "Email tối đa 255 ký tự.")]
        public string Email { get; set; } = null!;

        // UserEmailSource; Manual when typed by hand, the suggestion's source when added from a suggestion.
        [Range(0, 3, ErrorMessage = "Nguồn email không hợp lệ.")]
        public int Source { get; set; } = 3;

        [StringLength(255, ErrorMessage = "Ghi chú tối đa 255 ký tự.")]
        public string? Note { get; set; }

        public bool IsPrimary { get; set; }
    }

    public class UpdateUserEmailModulesDto
    {
        public List<UserEmailModuleItemDto> Items { get; set; } = new();
    }

    public class UserEmailModuleItemDto
    {
        [Required(ErrorMessage = "Mã module là bắt buộc.")]
        public string ModuleCode { get; set; } = null!;

        // Null = use the primary address.
        public int? UserEmailId { get; set; }
    }

    // What Identity holds for a domain account (DOMAIN\user); UserExists=false means no User row yet.
    public class DomainAccountEmailStatusDto
    {
        public string DomainAccount { get; set; } = null!;
        public bool UserExists { get; set; }
        public int? UserId { get; set; }
        public string? FullName { get; set; }
        public List<string> Emails { get; set; } = new();
    }

    public class LinkDomainAccountEmailsDto
    {
        [Required(ErrorMessage = "Tài khoản domain là bắt buộc.")]
        [StringLength(100, ErrorMessage = "Tài khoản domain tối đa 100 ký tự.")]
        [RegularExpression(@"^[^\\\s]+\\[^\\\s]+$", ErrorMessage = "Tài khoản domain phải có dạng DOMAIN\\username.")]
        public string DomainAccount { get; set; } = null!;

        // Display name for a User created by this call; ignored when the User already exists.
        [StringLength(100, ErrorMessage = "Họ tên tối đa 100 ký tự.")]
        public string? FullName { get; set; }

        [Required(ErrorMessage = "Cần ít nhất 1 email.")]
        [MinLength(1, ErrorMessage = "Cần ít nhất 1 email.")]
        public List<LinkDomainAccountEmailItemDto> Emails { get; set; } = new();
    }

    public class LinkDomainAccountEmailItemDto
    {
        [Required(ErrorMessage = "Email là bắt buộc.")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
        [StringLength(255, ErrorMessage = "Email tối đa 255 ký tự.")]
        public string Email { get; set; } = null!;

        [StringLength(255, ErrorMessage = "Ghi chú tối đa 255 ký tự.")]
        public string? Note { get; set; }
    }

    public class LinkDomainAccountEmailsResultDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public bool UserCreated { get; set; }
        public List<string> AddedEmails { get; set; } = new();
        // Addresses the User already held.
        public List<string> SkippedEmails { get; set; } = new();
    }

    public class UserEmailSuggestionDto
    {
        public string Email { get; set; } = null!;
        // UserEmailSource
        public int Source { get; set; }
        public string? Note { get; set; }
        public bool AlreadyAdded { get; set; }
    }
}
