// Lets a tabbed wrapper page put Refresh/Add in its header while still driving the active tab's list.
export interface ListHandle {
    refresh: () => void;
    openCreate: () => void;
}

export interface ListToolbarProps {
    onLoadingChange?: (loading: boolean) => void;
}
