export const COLLEGE = process.env.NEXT_PUBLIC_COLLEGE_NAME || 'Demo Institute of Technology';
export const COLLEGE_SHORT = process.env.NEXT_PUBLIC_COLLEGE_SHORT || 'DIT';
export const CELL = 'Equipment and Spaces Sharing Cell';

const STYLES: Record<string, { bar: string; chip: string; tile: string }> = {
  tool: { bar: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700', tile: 'bg-orange-500' },
  camera: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', tile: 'bg-rose-500' },
  space: { bar: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700', tile: 'bg-indigo-500' },
  device: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700', tile: 'bg-teal-500' },
  computer: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700', tile: 'bg-violet-500' },
};
export function categoryStyle(cat: string) {
  return (
    STYLES[(cat || '').toLowerCase()] ?? {
      bar: 'bg-slate-500',
      chip: 'bg-slate-100 text-slate-700',
      tile: 'bg-slate-500',
    }
  );
}
