/** Strip agent action blocks and count them, so we show a summary instead of raw code */
export function parseAgentMessage(content: string): { prose: string; fileCount: number; runCount: number; files: string[] } {
  const files: string[] = [];
  let runCount = 0;
  const fileRe = /```(?:\w+)?\s*file:([^\n]+)\n[\s\S]*?```/g;
  const runRe = /```run\n[\s\S]*?```/g;
  let m;
  while ((m = fileRe.exec(content)) !== null) files.push(m[1].trim());
  while ((m = runRe.exec(content)) !== null) runCount++;
  const prose = content
    .replace(fileRe, '')
    .replace(runRe, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { prose, fileCount: files.length, runCount, files };
}

export function formatArgs(args: any): string {
  try {
    const str = JSON.stringify(args);
    return str.length > 80 ? str.slice(0, 77) + '...' : str;
  } catch {
    return '';
  }
}
