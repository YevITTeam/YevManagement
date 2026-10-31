// Neither package ships types; otFormPdf.ts narrows them to the few calls it makes.
declare module "pdfmake/build/pdfmake" {
    const pdfMake: unknown;
    export default pdfMake;
}

declare module "html-to-pdfmake" {
    const htmlToPdfmake: unknown;
    export default htmlToPdfmake;
}
