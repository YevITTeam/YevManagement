using System.Text.Json.Nodes;

namespace Asset.Application.Dtos.AiChat
{
    // The 17-tool catalogue sent as Ollama's `tools` field (docs/ai-chat-be-huong-dan.md §5) — copied
    // verbatim from deviceTools.ts so the schema the model sees is identical to what it was tested
    // against on the FE. Keep this in sync with AiChatToolExecutorService.ExecuteAsync (1 case per
    // tool name here) and with the "Tool" enum-like set of names — adding a tool means updating both.
    public static class AiChatToolDefinitions
    {
        private const string ToolsJson = """
        [
          {
            "type": "function",
            "function": {
              "name": "search_devices",
              "description": "Tra cứu DANH SÁCH thiết bị (PC) theo mã thiết bị, người quản lý, địa chỉ IP, email hoặc tên nhà cung cấp. Trả về tối đa 10 kết quả gần đúng nhất. Dùng khi chưa biết chính xác mã thiết bị hoặc cần liệt kê nhiều máy.",
              "parameters": {
                "type": "object",
                "properties": {
                  "deviceCode": { "type": "string", "description": "Mã thiết bị (tìm gần đúng)" },
                  "manager": { "type": "string", "description": "Tên người quản lý/đang sử dụng thiết bị" },
                  "ipAddress": { "type": "string", "description": "Địa chỉ IP của thiết bị" },
                  "email": { "type": "string", "description": "Email gắn với thiết bị" },
                  "supplierName": { "type": "string", "description": "Tên nhà cung cấp" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_device_detail",
              "description": "Lấy THÔNG TIN CHI TIẾT đầy đủ của ĐÚNG 1 thiết bị theo mã thiết bị: thông tin chung (chi nhánh, nhà cung cấp, loại máy, nhóm/bộ phận, người quản lý, email, IP, ngày mua, hạn khấu hao, trạng thái...), cấu hình phần cứng (CPU/RAM/ổ cứng/màn hình...) và danh sách phần mềm đã cài. Dùng khi đã biết chính xác mã thiết bị và cần biết đầy đủ thông tin về máy đó.",
              "parameters": {
                "type": "object",
                "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem chi tiết" } },
                "required": ["deviceCode"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_device_transfer_history",
              "description": "Lấy lịch sử chuyển giao/đổi máy (thiết bị cũ → thiết bị mới) liên quan tới 1 thiết bị theo mã thiết bị.",
              "parameters": {
                "type": "object",
                "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem lịch sử chuyển giao" } },
                "required": ["deviceCode"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_device_change_history",
              "description": "Lấy lịch sử thay đổi (tạo mới/sửa/xoá/khôi phục) của 1 thiết bị theo mã thiết bị, kèm ai sửa và sửa lúc nào.",
              "parameters": {
                "type": "object",
                "properties": { "deviceCode": { "type": "string", "description": "Mã thiết bị cần xem lịch sử thay đổi" } },
                "required": ["deviceCode"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_device_types",
              "description": "Tra cứu danh sách loại thiết bị (vd Laptop, Desktop, Màn hình...) theo từ khoá.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã loại thiết bị" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_device_groups",
              "description": "Tra cứu danh sách Nhóm thiết bị theo từ khoá tên/mã nhóm.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhóm" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_device_departments",
              "description": "Tra cứu danh sách Bộ phận quản lý thiết bị theo từ khoá tên/mã bộ phận.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã bộ phận" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_software",
              "description": "Tra cứu danh sách phần mềm trong danh mục (không phải phần mềm đã cài trên máy nào) theo từ khoá tên/mã phần mềm.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã phần mềm" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_ip_addresses",
              "description": "Tra cứu địa chỉ IP theo từ khoá (địa chỉ IP/ghi chú) hoặc theo mã thiết bị đang được gán IP đó.",
              "parameters": {
                "type": "object",
                "properties": {
                  "keyword": { "type": "string", "description": "Từ khoá địa chỉ IP hoặc ghi chú" },
                  "deviceCode": { "type": "string", "description": "Mã thiết bị đang được gán IP" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_branches",
              "description": "Tra cứu danh sách chi nhánh theo từ khoá tên hoặc mã chi nhánh.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã chi nhánh" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_suppliers",
              "description": "Tra cứu danh sách nhà cung cấp thiết bị theo từ khoá tên hoặc mã nhà cung cấp.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhà cung cấp" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_software_groups",
              "description": "Tra cứu danh sách Nhóm phần mềm (danh mục phân loại phần mềm) theo từ khoá tên/mã nhóm.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá tên hoặc mã nhóm phần mềm" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_ip_prefixes",
              "description": "Tra cứu danh sách dải mạng (subnet/IP prefix) theo từ khoá — gồm chi nhánh sở hữu, subnet mask, gateway, DNS, số IP đã dùng/còn trống trong dải.",
              "parameters": {
                "type": "object",
                "properties": { "keyword": { "type": "string", "description": "Từ khoá dải mạng hoặc mô tả" } },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_ip_prefix_usage",
              "description": "Lấy tình trạng sử dụng của 1 dải mạng (IP prefix, dạng 3 octet vd \"10.45.1\"): IP nào đang được gán cho thiết bị nào, và IP nào còn trống chưa sử dụng, kèm tổng số IP đã dùng/còn trống. Dùng khi hỏi kiểu \"dải 10.45.1 còn IP nào trống\", \"IP nào trong dải 10.45.1 đang được dùng\". Muốn tra 1 địa chỉ IP cụ thể hoặc theo mã thiết bị thì dùng search_ip_addresses thay vì tool này.",
              "parameters": {
                "type": "object",
                "properties": { "prefix": { "type": "string", "description": "Dải mạng 3 octet cần tra cứu, vd \"10.45.1\"" } },
                "required": ["prefix"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_device_report",
              "description": "Lấy BÁO CÁO danh sách thiết bị phục vụ thống kê/kế toán: ngày mua, hạn khấu hao, tình trạng đã hết hạn hay chưa, kỳ tài chính — lọc theo loại thiết bị và/hoặc chi nhánh. Dùng khi người dùng hỏi kiểu tổng hợp/báo cáo (vd \"máy nào sắp hết khấu hao\", \"báo cáo thiết bị chi nhánh X\") thay vì hỏi 1 máy cụ thể.",
              "parameters": {
                "type": "object",
                "properties": {
                  "deviceTypeName": { "type": "string", "description": "Tên loại thiết bị cần lọc (vd Laptop)" },
                  "branchName": { "type": "string", "description": "Tên chi nhánh cần lọc" },
                  "keyword": { "type": "string", "description": "Từ khoá mã/tên thiết bị" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_asset_settings",
              "description": "Lấy cấu hình chung của hệ thống quản lý thiết bị — hiện có: sau bao nhiêu tháng kể từ khi thiết bị hết hạn sử dụng thì tự động chuyển sang trạng thái \"Chờ thanh lý\".",
              "parameters": { "type": "object", "properties": {}, "required": [] }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_audit_trail",
              "description": "Tra cứu NHẬT KÝ THAY ĐỔI (lịch sử tạo mới/sửa/xoá/khôi phục) trên toàn hệ thống quản lý thiết bị, không giới hạn ở 1 thiết bị cụ thể — dùng khi hỏi kiểu \"ai vừa sửa gì\", \"hôm nay có thay đổi gì\". Muốn xem lịch sử của riêng 1 thiết bị thì dùng get_device_change_history thay vì tool này.",
              "parameters": {
                "type": "object",
                "properties": {
                  "tableName": { "type": "string", "description": "Tên bảng dữ liệu cần lọc, vd \"Device\", \"Branch\", \"Supplier\"" },
                  "action": { "type": "string", "description": "Loại thao tác: Create, Update, Delete hoặc Restore" },
                  "changedBy": { "type": "string", "description": "Tên người thực hiện thay đổi" },
                  "fromDate": { "type": "string", "description": "Từ ngày (yyyy-MM-dd)" },
                  "toDate": { "type": "string", "description": "Đến ngày (yyyy-MM-dd)" }
                },
                "required": []
              }
            }
          }
        ]
        """;

        // Parsed once at startup. JsonNode is single-parent (cannot be attached to 2 different
        // JsonObjects at once) — callers MUST DeepClone() this before inserting it into a request body.
        public static readonly JsonNode Tools = JsonNode.Parse(ToolsJson)!;
    }
}
