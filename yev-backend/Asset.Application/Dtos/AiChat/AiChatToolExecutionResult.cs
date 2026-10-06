using System.Collections.Generic;

namespace Asset.Application.Dtos.AiChat
{
    // Structured result of 1 tool call (docs/docs-be/asset-module.md §1.18). `Json` is what still goes
    // into the "tool" role message sent back to Ollama; `DeviceReferences` is extra metadata used ONLY
    // by AiChatService to emit `{"type":"device"}` stream events for the FE's deep-link buttons — it
    // never reaches the model.
    public class AiChatToolExecutionResult
    {
        public string Json { get; set; } = null!;
        public List<AiChatDeviceReferenceDto> DeviceReferences { get; set; } = new();
    }

    public class AiChatDeviceReferenceDto
    {
        public int Id { get; set; }
        public string DeviceCode { get; set; } = null!;
    }
}
