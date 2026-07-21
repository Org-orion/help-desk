import writeXlsxFile, { type Cell, type Image, type Sheet, type SheetData } from 'write-excel-file/browser'
import type { EquipmentQrLabel, EquipmentQrLabelSize } from './equipment-qr-labels'
import { getLabelRenderSpec, ZEBRA_LABEL_DPI } from './equipment-qr-label-renderer.ts'

export type ZebraPrintableLabel = EquipmentQrLabel & { qrDataUrl: string; labelPng: Blob; labelPngDataUrl: string }
export const ZEBRA_HEADERS = ['CODIGO_ETIQUETA','PATRIMONIO','NUMERO','PREFIXO','QR_VALUE','STATUS','DATA_GERACAO'] as const
export const excelSafe=(value:unknown)=>{const text=String(value??'');return /^[=+\-@]/.test(text)?`'${text}`:text}
export const isLocalLabelUrl=(value:string)=>{try{const hostname=new URL(value).hostname.toLowerCase();return hostname==='localhost'||hostname==='0.0.0.0'||hostname==='::1'||hostname.startsWith('127.')}catch{return true}}
const splitCode=(code:string)=>{const at=code.lastIndexOf('-');return at<0?{prefix:'',number:code}:{prefix:code.slice(0,at),number:code.slice(at+1)}}
const formatBrazilianDateTime=(isoDate:string)=>{const date=new Date(isoDate);if(Number.isNaN(date.getTime()))return excelSafe(isoDate);return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date).replace(',','')}
const textCell=(value:unknown,extra:Record<string,unknown>={}):Cell=>({value:excelSafe(value),type:String,format:'@',...extra} as Cell)

export function createZebraDataSheet(labels:EquipmentQrLabel[]):SheetData{
 const header=ZEBRA_HEADERS.map(value=>textCell(value,{fontWeight:'bold',textColor:'#FFFFFF',backgroundColor:'#166534',align:'center',height:24}))
 return [header,...labels.map(label=>{const {prefix,number}=splitCode(label.displayCode);return [textCell(label.displayCode),textCell(label.displayCode),textCell(number),textCell(prefix),textCell(label.publicUrl??''),textCell(label.status==='BOUND'?'VINCULADA':label.status==='REVOKED'?'REVOGADA':'NAO_VINCULADA'),textCell(formatBrazilianDateTime(label.createdAt))]})]
}

const createLabelGrid=(count:number,columns:number):SheetData=>Array.from({length:Math.ceil(count/columns)},()=>Array.from({length:columns},()=>textCell('',{height:113.4,backgroundColor:'#FFFFFF'})))
export function createLabelImages(labels:Pick<ZebraPrintableLabel,'displayCode'|'labelPng'>[],columns:number,size:EquipmentQrLabelSize):Image[]{const spec=getLabelRenderSpec(size);return labels.map((label,index)=>({content:label.labelPng,contentType:'image/png',width:spec.widthPx,height:spec.heightPx,dpi:ZEBRA_LABEL_DPI,anchor:{row:Math.floor(index/columns)+1,column:index%columns+1},title:`Etiqueta ${label.displayCode}`,description:`Etiqueta patrimonial ${label.displayCode}`}))}

export function createZebraWorkbookSheets(labels:ZebraPrintableLabel[],columns:number,size:EquipmentQrLabelSize='100x40'):Sheet<Blob|ArrayBuffer>[] {
 const safeColumns=size==='100x40'?1:Math.max(1,Math.min(5,Math.trunc(columns)))
 const spec=getLabelRenderSpec(size)
 return [
  {sheet:'Etiquetas',data:createLabelGrid(labels.length,safeColumns),images:createLabelImages(labels,safeColumns,size),columns:Array.from({length:safeColumns},()=>({width:Math.round(spec.widthMm/1.875)})),showGridLines:false,orientation:'landscape'},
  {sheet:'Dados Zebra',data:createZebraDataSheet(labels),stickyRowsCount:1,showGridLines:false,columns:[{width:20},{width:20},{width:12},{width:14},{width:64},{width:18},{width:22}]},
 ]
}

export async function downloadZebraWorkbook(labels:ZebraPrintableLabel[],columns:number,size:EquipmentQrLabelSize){
 const sheets=createZebraWorkbookSheets(labels,columns,size)
 const now=new Date(),localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
 const fileName=`etiquetas-zebra-${localDate}.xlsx`
 await writeXlsxFile(sheets).toFile(fileName)
 return fileName
}
