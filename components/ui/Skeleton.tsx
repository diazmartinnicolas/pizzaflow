import { motion } from 'framer-motion';

export const Skeleton = ({ className }: { className?: string }) => (
    <motion.div
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className={`bg-gray-200 rounded-lg ${className}`}
    />
);

export const ProductSkeleton = () => (
    <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col gap-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between items-center mt-auto">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    </div>
);

export const TableRowSkeleton = ({ cols = 5 }: { cols?: number }) => (
    <tr className="animate-pulse">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="p-4">
                <Skeleton className="h-4 w-full" />
            </td>
        ))}
    </tr>
);
