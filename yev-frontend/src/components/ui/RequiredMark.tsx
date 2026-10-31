// #930006 is the brand "error" red; #e3000f is reserved for actions (buttons/links).
export function RequiredMark() {
    return (
        <span className="text-[#930006]" aria-hidden="true">
            {" "}
            *
        </span>
    );
}
