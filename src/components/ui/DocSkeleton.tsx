export default function DocSkeleton() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-8 lg:px-14 py-12">
      {/* Title skeleton */}
      <div className="skeleton h-9 w-3/5 mb-6" />

      {/* Content skeleton lines */}
      <div className="space-y-3">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-0 mt-2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}
