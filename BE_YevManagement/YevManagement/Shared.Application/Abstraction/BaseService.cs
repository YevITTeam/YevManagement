using Shared.Application.Abstractions;

namespace Shared.Application.Services
{
    public abstract class BaseService<TUnitOfWork> where TUnitOfWork : IUnitOfWork
    {
        protected readonly TUnitOfWork _unitOfWork;

        protected BaseService(TUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }
    }
}