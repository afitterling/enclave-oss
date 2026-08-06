interface Props {
  files: string[] | null;
  selected: string | null;
  onView: (file: string) => void;
  /** Omitted when the fileDelete feature is disabled. */
  onDelete?: (file: string) => void;
}

export default function FileList({ files, selected, onView, onDelete }: Props) {
  if (files === null) return <p className="loading">listing</p>;
  if (files.length === 0) return <p className="empty">No files in this stage yet.</p>;
  return (
    <ul className="list">
      {files.map((f) => (
        <li key={f}>
          <div className="grow">
            <a
              className="plain"
              href="#view"
              onClick={(e) => {
                e.preventDefault();
                onView(f);
              }}
              style={selected === f ? { color: "var(--accent)" } : undefined}
            >
              {f}
            </a>
          </div>
          <button className="btn quiet" onClick={() => onView(f)}>
            view
          </button>
          {onDelete && (
            <button className="btn quiet danger" onClick={() => onDelete(f)}>
              delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
