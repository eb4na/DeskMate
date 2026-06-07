// Memobun is designed cream/light-first; the dark palette is unfinished (renders
// brown), so we lock the whole app to light mode regardless of system setting.
export function useColorScheme(): 'light' {
  return 'light';
}
