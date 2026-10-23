export class CvError extends Error {
  constructor(public code: string, public status = 422) {
    super(code);
    this.name = "CvError";
  }
}
