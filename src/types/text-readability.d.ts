declare module "text-readability" {
  export function fleschReadingEase(text: string): number;
  export function gunningFog(text: string): number;
  export function fleschKincaidGrade(text: string): number;
  export function colemanLiauIndex(text: string): number;
  export function smogIndex(text: string): number;
  export function difficultWords(text: string): number;
  export function textStandard(
    text: string,
    floatOutput?: boolean,
  ): string | number;

  const rs: {
    fleschReadingEase(text: string): number;
    gunningFog(text: string): number;
    fleschKincaidGrade(text: string): number;
    colemanLiauIndex(text: string): number;
    smogIndex(text: string): number;
    difficultWords(text: string): number;
    textStandard(text: string, floatOutput?: boolean): string | number;
  };

  export default rs;
}
