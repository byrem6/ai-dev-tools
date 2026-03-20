export class TokenUtils {
  static estimateTokens(str: string): number {
    return Math.ceil(str.length / 4);
  }

  static estimateTokensForObject(obj: any): number {
    const json = JSON.stringify(obj);
    return this.estimateTokens(json);
  }

  static estimateTokensForArray(arr: any[]): number {
    return arr.reduce((total, item) => {
      return total + this.estimateTokensForObject(item);
    }, 0);
  }

  static estimateTokensForLines(lines: string[]): number {
    return lines.reduce((total, line) => {
      return total + this.estimateTokens(line);
    }, 0);
  }

  static estimateTokensForMatch(
    file: string,
    line: number,
    col: number,
    text: string
  ): number {
    const match = `${file}:${line}:${col}:${text}`;
    return this.estimateTokens(match);
  }

  static estimateTokensForMatches(matches: Array<{
    file: string;
    line: number;
    col: number;
    text: string;
  }>): number {
    return matches.reduce((total, match) => {
      return total + this.estimateTokensForMatch(
        match.file,
        match.line,
        match.col,
        match.text
      );
    }, 0);
  }

  static formatTokenCount(count: number): string {
    if (count < 1000) {
      return `${count}T`;
    }
    if (count < 1000000) {
      return `${(count / 1000).toFixed(1)}kT`;
    }
    return `${(count / 1000000).toFixed(1)}mT`;
  }
}
