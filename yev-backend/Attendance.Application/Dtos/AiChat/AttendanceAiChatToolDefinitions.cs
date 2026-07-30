using System.Text.Json.Nodes;

namespace Attendance.Application.Dtos.AiChat
{
    // The tool catalogue sent as Ollama's `tools` field (docs/docs-be/attendance-aichat-be-huong-dan.md
    // §5) — 6 read-only lookup tools + exactly 1 write tool (create_ot_form_draft). Keep this in sync
    // with AttendanceAiChatToolExecutorService.ExecuteAsync (1 case per tool name here) — adding a
    // tool means updating both.
    public static class AttendanceAiChatToolDefinitions
    {
        private const string ToolsJson = """
        [
          {
            "type": "function",
            "function": {
              "name": "search_departments",
              "description": "Tra cứu danh sách Bộ phận/Phòng ban (Department) đang hoạt động trong hệ thống chấm công. Dùng để tìm departmentId theo tên.",
              "parameters": {
                "type": "object",
                "properties": {
                  "keyword": { "type": "string", "description": "Từ khoá tên Bộ phận cần tìm (không bắt buộc, để trống sẽ trả về toàn bộ)" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_groups",
              "description": "Tra cứu danh sách Nhóm (Group) đang hoạt động — mỗi Nhóm thuộc đúng 1 Bộ phận (Department). Dùng để tìm groupId theo tên, hoặc lọc theo departmentId nếu đã biết Bộ phận.",
              "parameters": {
                "type": "object",
                "properties": {
                  "departmentId": { "type": "integer", "description": "Lọc Nhóm theo Bộ phận (không bắt buộc)" },
                  "keyword": { "type": "string", "description": "Từ khoá tên Nhóm cần tìm (không bắt buộc)" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_reasons",
              "description": "Tra cứu danh sách Lý do tăng ca đang hoạt động. Dùng để tìm reasonId theo tên lý do.",
              "parameters": {
                "type": "object",
                "properties": {
                  "keyword": { "type": "string", "description": "Từ khoá tên Lý do cần tìm (không bắt buộc)" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_ot_cases",
              "description": "Tra cứu danh sách Trường hợp OT (OtCase, vd TH1/TH2/TH3) đang hoạt động, kèm thông tin có bắt buộc chữ ký hay không và cấp duyệt cuối cùng cần đạt. Dùng để tìm otCaseId theo mã/mô tả.",
              "parameters": {
                "type": "object",
                "properties": {
                  "keyword": { "type": "string", "description": "Từ khoá mã hoặc mô tả Trường hợp OT cần tìm (không bắt buộc)" }
                },
                "required": []
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "search_employees_by_group",
              "description": "Tra cứu danh sách Nhân viên thuộc 1 Nhóm (Group) cụ thể — BẮT BUỘC phải biết groupId trước (gọi search_groups nếu chưa có). Dùng để tìm employeeId cho danh sách nhân viên tham gia tăng ca — nhân viên PHẢI thuộc đúng Nhóm của đơn đang lập.",
              "parameters": {
                "type": "object",
                "properties": {
                  "groupId": { "type": "integer", "description": "Id của Nhóm cần liệt kê nhân viên" }
                },
                "required": ["groupId"]
              }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "get_my_create_scopes",
              "description": "Lấy danh sách Nhóm/Bộ phận mà CHÍNH người đang trò chuyện (không phải người khác) được phép tạo đơn tăng ca — không cần tham số, luôn tự động theo đúng người đang hỏi. PHẢI gọi tool này ĐẦU TIÊN, ngay khi người dùng ngỏ ý muốn lập đơn — TRƯỚC cả khi hỏi Nhóm/Bộ phận là gì, vì phần lớn người dùng chỉ có đúng 1 lựa chọn hợp lệ nên không cần hỏi lại. Lưu ý: nếu người đang hỏi là Admin, danh sách trả về RỖNG có nghĩa là KHÔNG giới hạn (được tạo cho mọi Nhóm/Bộ phận), không phải là không được phép tạo ở đâu cả.",
              "parameters": { "type": "object", "properties": {}, "required": [] }
            }
          },
          {
            "type": "function",
            "function": {
              "name": "create_ot_form_draft",
              "description": "TẠO THẬT 1 đơn tăng ca ở trạng thái NHÁP (Draft) trong hệ thống — đây là tool DUY NHẤT có thể GHI dữ liệu. CHỈ được gọi tool này SAU KHI đã trình bày đầy đủ tóm tắt đơn cho người dùng VÀ nhận được xác nhận rõ ràng bằng 1 tin nhắn khẳng định riêng (vd 'đồng ý', 'xác nhận', 'ok', 'tạo đi') — tuyệt đối không gọi tool này ngay trong lượt vừa trình bày tóm tắt, cũng không tự cho rằng đã được xác nhận nếu người dùng chưa thực sự trả lời khẳng định. groupId/departmentId/reasonId/otCaseId/employeeId PHẢI lấy từ kết quả các tool tra cứu ở trên, TUYỆT ĐỐI không tự bịa số id. Đơn tạo ra vẫn ở trạng thái Nháp, chưa có chữ ký — Trưởng nhóm vẫn phải tự thao tác ký duyệt trên hệ thống sau đó, và hệ thống sẽ gửi email thật cho Trưởng nhóm liên quan ngay sau khi tạo.",
              "parameters": {
                "type": "object",
                "properties": {
                  "groupId": { "type": "integer", "description": "Id của Nhóm — lấy từ tool search_groups hoặc get_my_create_scopes" },
                  "departmentId": { "type": "integer", "description": "Id của Bộ phận — phải khớp đúng Bộ phận của Nhóm đã chọn" },
                  "reasonId": { "type": "integer", "description": "Id của Lý do tăng ca — lấy từ tool search_reasons" },
                  "otCaseId": { "type": "integer", "description": "Id của Trường hợp OT — lấy từ tool search_ot_cases" },
                  "startTime": { "type": "string", "description": "Giờ bắt đầu OT của cả đơn, định dạng HH:mm" },
                  "endTime": { "type": "string", "description": "Giờ kết thúc OT tối đa của cả đơn, định dạng HH:mm" },
                  "subReason": { "type": "string", "description": "Lý do chi tiết bổ sung (không bắt buộc)" },
                  "totalHour": { "type": "number", "description": "Tổng số giờ tăng ca, tính từ startTime tới endTime" },
                  "date": { "type": "string", "description": "Ngày tăng ca, định dạng yyyy-MM-dd" },
                  "employees": {
                    "type": "array",
                    "description": "Danh sách nhân viên tham gia tăng ca — employeeId lấy từ tool search_employees_by_group, phải cùng Nhóm với groupId đã chọn",
                    "items": {
                      "type": "object",
                      "properties": {
                        "employeeId": { "type": "integer" },
                        "endTime": { "type": "string", "description": "Giờ kết thúc OT riêng của nhân viên này, HH:mm — phải sau startTime và không vượt quá endTime của cả đơn" },
                        "noteVn": { "type": "string" },
                        "noteJp": { "type": "string" }
                      },
                      "required": ["employeeId", "endTime"]
                    }
                  },
                  "processPart": {
                    "type": "object",
                    "description": "Thông tin ăn/đi lại/phòng photo — không bắt buộc, bỏ qua nếu người dùng không đề cập tới",
                    "properties": {
                      "isEat": { "type": "boolean" },
                      "mainTicketCount": { "type": "integer" },
                      "secondaryTicketCount": { "type": "integer" },
                      "milkCount": { "type": "integer" },
                      "isTransportation": { "type": "boolean" },
                      "isUseCopyRoom": { "type": "boolean" },
                      "anotherSuggestionVn": { "type": "string" },
                      "anotherSuggestionJp": { "type": "string" }
                    }
                  }
                },
                "required": ["groupId", "departmentId", "reasonId", "otCaseId", "startTime", "endTime", "totalHour", "date", "employees"]
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
