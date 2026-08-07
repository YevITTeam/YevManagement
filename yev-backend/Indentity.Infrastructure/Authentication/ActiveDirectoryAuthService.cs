using Identity.Application.Interfaces.Service;
using System.DirectoryServices.AccountManagement;

namespace Identity.Infrastructure.Authentication
{
    public class ActiveDirectoryAuthService : IActiveDirectoryAuthService
    {
        public bool ValidateCredentials(string domain, string userName, string password)
        {
            // BẮT BUỘC dùng ContextOptions.SimpleBind tường minh — KHÔNG được gọi overload 2 tham số
            // `ValidateCredentials(userName, password)`. Overload đó mặc định dùng
            // `ContextOptions.Negotiate`, và đã kiểm chứng thực tế trên máy này: khi tiến trình BE đang
            // chạy dưới 1 tài khoản domain đã có sẵn Kerberos ticket hợp lệ, Negotiate bind trả về
            // `true` cho BẤT KỲ username/password nào (kể cả user không tồn tại) — tự "negotiate" bằng
            // danh tính tiến trình thay vì thật sự kiểm tra credential được truyền vào. SimpleBind ép
            // LDAP bind thật sự bằng đúng username/password đã nhận, không rơi vào lỗi này.
            // SimpleBind là LDAP bind thật, không tự resolve sAMAccountName trần như Negotiate/Kerberos —
            // phải truyền theo down-level logon name "DOMAIN\username" thì AD mới bind đúng user
            // (đã kiểm chứng thực tế: sAMAccountName trần luôn bị AD từ chối dưới SimpleBind dù đúng
            // mật khẩu, dù chính sAMAccountName đó đăng nhập Negotiate bình thường).
            using var principalContext = new PrincipalContext(ContextType.Domain, domain);
            return principalContext.ValidateCredentials($"{domain}\\{userName}", password, ContextOptions.SimpleBind);
        }
    }
}
