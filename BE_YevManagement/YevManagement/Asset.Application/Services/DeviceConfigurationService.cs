using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class DeviceConfigurationService : BaseService<IAssetUnitOfWork>, IDeviceConfigurationService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public DeviceConfigurationService(IAssetUnitOfWork unitOfWork, IHttpContextAccessor httpContextAccessor) : base(unitOfWork)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<DeviceConfigurationDto?> GetByDeviceIdAsync(int deviceId)
        {
            var config = await _unitOfWork.DeviceConfigurations.FirstOrDefaultAsync(x => x.DeviceId == deviceId, x => x.Device);
            return config == null ? null : MapToDto(config);
        }

        public async Task<DeviceConfigurationDto> CreateAsync(CreateDeviceConfigurationDto request)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(request.DeviceId);
            device.OrThrowNotFound("Thiết bị", request.DeviceId);

            var exists = await _unitOfWork.DeviceConfigurations.FirstOrDefaultAsync(x => x.DeviceId == request.DeviceId);
            if (exists != null) throw new DomainException("Thiết bị này đã có cấu hình, vui lòng dùng chức năng cập nhật.");

            var newConfig = new DeviceConfiguration
            {
                DeviceId = request.DeviceId,
                Mainboard = request.Mainboard,
                Cpu = request.Cpu,
                Ram = request.Ram,
                HardDrive = request.HardDrive,
                Monitor = request.Monitor,
                Mouse = request.Mouse,
                Keyboard = request.Keyboard,
                Headphone = request.Headphone,
                Speaker = request.Speaker,
                Ups = request.Ups,
                Psu = request.Psu,
                Os = request.Os,
                Vga = request.Vga,
                Maker = request.Maker,
                Model = request.Model,
                PowerAdapter = request.PowerAdapter,
                WirelessCard = request.WirelessCard,
                Nic = request.Nic,
                Other = request.Other,
                Note = request.Note
            };

            await _unitOfWork.DeviceConfigurations.AddAsync(newConfig);
            await _unitOfWork.SaveChangesAsync();

            var initial = new DeviceConfigurationInitial
            {
                DeviceConfigurationId = newConfig.Id,
                Mainboard = newConfig.Mainboard,
                Cpu = newConfig.Cpu,
                Ram = newConfig.Ram,
                HardDrive = newConfig.HardDrive,
                Monitor = newConfig.Monitor,
                Mouse = newConfig.Mouse,
                Keyboard = newConfig.Keyboard,
                Headphone = newConfig.Headphone,
                Speaker = newConfig.Speaker,
                Ups = newConfig.Ups,
                Psu = newConfig.Psu,
                Os = newConfig.Os,
                Vga = newConfig.Vga,
                Maker = newConfig.Maker,
                Model = newConfig.Model,
                PowerAdapter = newConfig.PowerAdapter,
                WirelessCard = newConfig.WirelessCard,
                Nic = newConfig.Nic,
                Other = newConfig.Other,
                Note = newConfig.Note,
                CreatedAt = TimeHelper.GetCurrentUtcTime()
            };

            await _unitOfWork.DeviceConfigurationInitials.AddAsync(initial);
            await _unitOfWork.SaveChangesAsync();

            var dto = MapToDto(newConfig);
            dto.DeviceCode = device.DeviceCode;
            return dto;
        }

        public async Task UpdateAsync(UpdateDeviceConfigurationDto request)
        {
            var config = await _unitOfWork.DeviceConfigurations.GetByIdAsync(request.Id);
            config.OrThrowNotFound("Cấu hình thiết bị", request.Id);

            // 2026-07-11 (finalized): removed the check comparing request.DeviceId with config.DeviceId —
            // DeviceId was never actually written below (only the 20 configuration fields change), so
            // this check served only as validation without any real effect, and caused false errors when
            // the FE sent a mismatched deviceId for an otherwise normal configuration update request. The
            // `id` in the route already identifies the correct record to update; deviceId is not needed
            // for extra verification.

            if (HasChanges(config, request))
            {
                var history = new DeviceConfigurationHistory
                {
                    DeviceConfigurationId = config.Id,
                    Mainboard = request.Mainboard,
                    Cpu = request.Cpu,
                    Ram = request.Ram,
                    HardDrive = request.HardDrive,
                    Monitor = request.Monitor,
                    Mouse = request.Mouse,
                    Keyboard = request.Keyboard,
                    Headphone = request.Headphone,
                    Speaker = request.Speaker,
                    Ups = request.Ups,
                    Psu = request.Psu,
                    Os = request.Os,
                    Vga = request.Vga,
                    Maker = request.Maker,
                    Model = request.Model,
                    PowerAdapter = request.PowerAdapter,
                    WirelessCard = request.WirelessCard,
                    Nic = request.Nic,
                    Other = request.Other,
                    Note = request.Note,
                    EditedAt = TimeHelper.GetCurrentUtcTime(),
                    EditedBy = GetCurrentUser()
                };

                await _unitOfWork.DeviceConfigurationHistories.AddAsync(history);
            }

            config.Mainboard = request.Mainboard;
            config.Cpu = request.Cpu;
            config.Ram = request.Ram;
            config.HardDrive = request.HardDrive;
            config.Monitor = request.Monitor;
            config.Mouse = request.Mouse;
            config.Keyboard = request.Keyboard;
            config.Headphone = request.Headphone;
            config.Speaker = request.Speaker;
            config.Ups = request.Ups;
            config.Psu = request.Psu;
            config.Os = request.Os;
            config.Vga = request.Vga;
            config.Maker = request.Maker;
            config.Model = request.Model;
            config.PowerAdapter = request.PowerAdapter;
            config.WirelessCard = request.WirelessCard;
            config.Nic = request.Nic;
            config.Other = request.Other;
            config.Note = request.Note;

            _unitOfWork.DeviceConfigurations.Update(config);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var config = await _unitOfWork.DeviceConfigurations.GetByIdAsync(id);
            config.OrThrowNotFound("Cấu hình thiết bị", id);

            _unitOfWork.DeviceConfigurations.Delete(config);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<DeviceConfigurationInitialDto?> GetInitialByConfigIdAsync(int deviceConfigurationId)
        {
            var initial = await _unitOfWork.DeviceConfigurationInitials.FirstOrDefaultAsync(x => x.DeviceConfigurationId == deviceConfigurationId);
            return initial == null ? null : MapToDto(initial);
        }

        public async Task DeleteInitialAsync(int id)
        {
            var initial = await _unitOfWork.DeviceConfigurationInitials.GetByIdAsync(id);
            initial.OrThrowNotFound("Cấu hình ban đầu", id);

            _unitOfWork.DeviceConfigurationInitials.Delete(initial);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<DeviceConfigurationHistoryDto>> GetHistoryAsync(int deviceConfigurationId)
        {
            var history = await _unitOfWork.DeviceConfigurationHistories.FindAsync(x => x.DeviceConfigurationId == deviceConfigurationId);
            return history
                .OrderByDescending(x => x.EditedAt)
                .Select(MapToDto)
                .ToList();
        }

        private string GetCurrentUser() => _httpContextAccessor.HttpContext?.User?.Identity?.Name ?? "Unknown";

        private static bool HasChanges(DeviceConfiguration config, UpdateDeviceConfigurationDto request) =>
            config.Mainboard != request.Mainboard ||
            config.Cpu != request.Cpu ||
            config.Ram != request.Ram ||
            config.HardDrive != request.HardDrive ||
            config.Monitor != request.Monitor ||
            config.Mouse != request.Mouse ||
            config.Keyboard != request.Keyboard ||
            config.Headphone != request.Headphone ||
            config.Speaker != request.Speaker ||
            config.Ups != request.Ups ||
            config.Psu != request.Psu ||
            config.Os != request.Os ||
            config.Vga != request.Vga ||
            config.Maker != request.Maker ||
            config.Model != request.Model ||
            config.PowerAdapter != request.PowerAdapter ||
            config.WirelessCard != request.WirelessCard ||
            config.Nic != request.Nic ||
            config.Other != request.Other ||
            config.Note != request.Note;

        private static DeviceConfigurationDto MapToDto(DeviceConfiguration config) => new DeviceConfigurationDto
        {
            Id = config.Id,
            DeviceId = config.DeviceId,
            DeviceCode = config.Device?.DeviceCode!,
            Mainboard = config.Mainboard,
            Cpu = config.Cpu,
            Ram = config.Ram,
            HardDrive = config.HardDrive,
            Monitor = config.Monitor,
            Mouse = config.Mouse,
            Keyboard = config.Keyboard,
            Headphone = config.Headphone,
            Speaker = config.Speaker,
            Ups = config.Ups,
            Psu = config.Psu,
            Os = config.Os,
            Vga = config.Vga,
            Maker = config.Maker,
            Model = config.Model,
            PowerAdapter = config.PowerAdapter,
            WirelessCard = config.WirelessCard,
            Nic = config.Nic,
            Other = config.Other,
            Note = config.Note
        };

        private static DeviceConfigurationInitialDto MapToDto(DeviceConfigurationInitial initial) => new DeviceConfigurationInitialDto
        {
            Id = initial.Id,
            DeviceConfigurationId = initial.DeviceConfigurationId,
            Mainboard = initial.Mainboard,
            Cpu = initial.Cpu,
            Ram = initial.Ram,
            HardDrive = initial.HardDrive,
            Monitor = initial.Monitor,
            Mouse = initial.Mouse,
            Keyboard = initial.Keyboard,
            Headphone = initial.Headphone,
            Speaker = initial.Speaker,
            Ups = initial.Ups,
            Psu = initial.Psu,
            Os = initial.Os,
            Vga = initial.Vga,
            Maker = initial.Maker,
            Model = initial.Model,
            PowerAdapter = initial.PowerAdapter,
            WirelessCard = initial.WirelessCard,
            Nic = initial.Nic,
            Other = initial.Other,
            Note = initial.Note,
            CreatedAt = initial.CreatedAt
        };

        private static DeviceConfigurationHistoryDto MapToDto(DeviceConfigurationHistory history) => new DeviceConfigurationHistoryDto
        {
            Id = history.Id,
            DeviceConfigurationId = history.DeviceConfigurationId,
            Mainboard = history.Mainboard,
            Cpu = history.Cpu,
            Ram = history.Ram,
            HardDrive = history.HardDrive,
            Monitor = history.Monitor,
            Mouse = history.Mouse,
            Keyboard = history.Keyboard,
            Headphone = history.Headphone,
            Speaker = history.Speaker,
            Ups = history.Ups,
            Psu = history.Psu,
            Os = history.Os,
            Vga = history.Vga,
            Maker = history.Maker,
            Model = history.Model,
            PowerAdapter = history.PowerAdapter,
            WirelessCard = history.WirelessCard,
            Nic = history.Nic,
            Other = history.Other,
            Note = history.Note,
            EditedAt = history.EditedAt,
            EditedBy = history.EditedBy
        };
    }
}
