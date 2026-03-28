export default function SidebarSkeleton() {
  return (
    <div className="pt-2 px-2 space-y-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-6 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}
