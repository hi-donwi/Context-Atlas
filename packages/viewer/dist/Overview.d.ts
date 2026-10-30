import type { ContextSnapshot } from '@context-atlas/model';
interface OverviewProps {
    snapshot: ContextSnapshot;
    onView: (id: string) => void;
    onSelect: (id: string) => void;
}
export declare function Overview({ snapshot, onView, onSelect }: OverviewProps): import("react").JSX.Element;
export {};
