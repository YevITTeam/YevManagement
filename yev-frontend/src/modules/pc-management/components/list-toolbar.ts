// Lets tabbed wrapper pages put refresh/add buttons beside the title while controlling the active tab's list.
export interface ListHandle {
    refresh: () => void;
    openCreate: () => void;
}

export interface ListToolbarProps {
    onLoadingChange?: (loading: boolean) => void;
}
