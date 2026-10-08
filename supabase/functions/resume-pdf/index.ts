import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
import { corsHeaders } from "../_shared/googleDrive.ts";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const BOTTOM = 46;
const CONTENT_X = 164;
const CONTENT_W = PAGE_W - MARGIN - CONTENT_X;

const DARK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.38, 0.38, 0.38);
const LIGHT = rgb(0.72, 0.72, 0.72);
const RED = rgb(0.63, 0.05, 0.09);
const PAPER = rgb(0.985, 0.98, 0.965);

function json(message:string,status=400){
  return new Response(JSON.stringify({error:message}),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"},
  });
}

function safeText(value:unknown){
  return String(value ?? "")
    .replace(/[\u2012\u2013\u2014\u2212]/g,"-")
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201C\u201D]/g,'"')
    .replace(/\u2026/g,"...")
    .replace(/\u00A0/g," ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g,"")
    .trim();
}

function filename(value:unknown){
  const base=safeText(value||"curriculo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .toLowerCase();
  return (base||"curriculo")+".pdf";
}

function paragraphs(value:unknown){
  return safeText(value).split(/\n\s*\n/).map(item=>item.trim()).filter(Boolean);
}

function wrapText(text:string,font:any,size:number,maxWidth:number){
  const clean=safeText(text);
  if(!clean)return [];
  const words=clean.split(/\s+/);
  const lines:string[]=[];
  let line="";
  for(const word of words){
    const candidate=line?line+" "+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=maxWidth){
      line=candidate;
      continue;
    }
    if(line)lines.push(line);
    if(font.widthOfTextAtSize(word,size)<=maxWidth){
      line=word;
      continue;
    }
    let chunk="";
    for(const char of word){
      const next=chunk+char;
      if(font.widthOfTextAtSize(next,size)>maxWidth && chunk){
        lines.push(chunk);
        chunk=char;
      }else{
        chunk=next;
      }
    }
    line=chunk;
  }
  if(line)lines.push(line);
  return lines;
}

async function fetchResume(slug:string){
  const base=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!base||!key)throw new Error("Configuração do Supabase indisponível");
  const url=new URL("/rest/v1/resumes",base);
  url.searchParams.set("slug","eq."+slug);
  url.searchParams.set("status","eq.published");
  url.searchParams.set("select","*");
  url.searchParams.set("limit","1");
  const response=await fetch(url,{
    headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"},
  });
  if(!response.ok)throw new Error("Falha ao carregar currículo");
  const rows=await response.json();
  return Array.isArray(rows)?rows[0]||null:null;
}

async function embedPhoto(pdf:any,url:unknown){
  const source=safeText(url);
  if(!source)return null;
  try{
    const response=await fetch(source,{headers:{Accept:"image/jpeg,image/png,*/*"}});
    if(!response.ok)return null;
    const bytes=new Uint8Array(await response.arrayBuffer());
    const isJpeg=bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    const isPng=bytes.length>8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
    if(isJpeg)return await pdf.embedJpg(bytes);
    if(isPng)return await pdf.embedPng(bytes);
  }catch{}
  return null;
}

async function dataUrlToBytes(dataUrl:string){
  const encoded=dataUrl.split(",")[1]||"";
  if(!encoded)return new Uint8Array();
  const binary=atob(encoded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

async function embedQr(pdf:any,url:string){
  try{
    const dataUrl=await QRCode.toDataURL(url,{
      errorCorrectionLevel:"M",
      margin:1,
      width:320,
      color:{dark:"#151515",light:"#FFFFFF"},
    });
    const bytes=await dataUrlToBytes(dataUrl);
    if(!bytes.length)return null;
    return await pdf.embedPng(bytes);
  }catch(error){
    console.warn("[resume-pdf] qr generation failed",error);
    return null;
  }
}

async function buildResumePdf(resume:any,onlineUrl:string){
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const photo=await embedPhoto(pdf,resume.photo_url);
  const qr=await embedQr(pdf,onlineUrl);

  let page:any;
  let y=0;
  const pages:any[]=[];

  function newPage(){
    page=pdf.addPage([PAGE_W,PAGE_H]);
    pages.push(page);
    page.drawRectangle({x:0,y:0,width:PAGE_W,height:PAGE_H,color:PAPER});
    y=PAGE_H-MARGIN;
    return page;
  }

  function ensureSpace(height:number){
    if(y-height<BOTTOM)newPage();
  }

  function drawRule(){
    ensureSpace(18);
    page.drawLine({
      start:{x:MARGIN,y:y-2},
      end:{x:PAGE_W-MARGIN,y:y-2},
      thickness:0.6,
      color:rgb(0.82,0.82,0.82),
    });
    y-=18;
  }

  function drawLines(lines:string[],opts:{
    x:number; maxWidth:number; font?:any; size?:number; lineHeight?:number; color?:any;
  }){
    const font=opts.font||regular;
    const size=opts.size||10;
    const lineHeight=opts.lineHeight||size*1.4;
    const color=opts.color||DARK;
    for(const line of lines){
      ensureSpace(lineHeight+3);
      page.drawText(safeText(line),{x:opts.x,y,font,size,color,maxWidth:opts.maxWidth});
      y-=lineHeight;
    }
  }

  function drawParagraph(text:string,x=CONTENT_X,maxWidth=CONTENT_W,size=10,lineHeight=14.2,color=DARK){
    const lines=wrapText(text,regular,size,maxWidth);
    drawLines(lines,{x,maxWidth,font:regular,size,lineHeight,color});
    y-=5;
  }

  function drawSectionHeading(label:string){
    ensureSpace(28);
    page.drawText(safeText(label).toUpperCase(),{
      x:MARGIN,y,font:bold,size:7.5,color:MUTED,maxWidth:105,
    });
    page.drawRectangle({x:MARGIN,y:y-10,width:24,height:2.2,color:RED});
  }

  function drawSection(label:string,items:string[]){
    if(!items.length)return;
    drawRule();
    ensureSpace(48);
    const sectionStart=y;
    drawSectionHeading(label);
    y=sectionStart;
    for(const item of items)drawParagraph(item);
    y-=2;
  }

  function drawContinuationHeader(){
    page.drawText(safeText(resume.display_name||"Currículo"),{
      x:MARGIN,y,font:bold,size:15,color:DARK,maxWidth:300,
    });
    page.drawText("Informações complementares",{
      x:MARGIN,y:y-16,font:regular,size:8.5,color:MUTED,maxWidth:220,
    });
    page.drawLine({
      start:{x:MARGIN,y:y-28},
      end:{x:PAGE_W-MARGIN,y:y-28},
      thickness:0.6,
      color:rgb(0.84,0.84,0.84),
    });
    y-=44;
  }

  function ensureClosingSpace(height:number){
    if(y-height<BOTTOM){
      newPage();
      drawContinuationHeader();
    }
  }

  newPage();

  const meta=[
    safeText(resume.eyebrow||"Minicurrículo profissional"),
    safeText(resume.location),
    resume.market_since?"Atuação desde "+resume.market_since:"",
  ].filter(Boolean).join("  •  ");
  page.drawText(meta,{x:MARGIN,y,font:bold,size:7.3,color:MUTED,maxWidth:PAGE_W-(MARGIN*2)});
  y-=30;

  let photoBottom=PAGE_H-MARGIN-126;
  if(photo){
    const fit=photo.scaleToFit(88,108);
    const x=PAGE_W-MARGIN-fit.width;
    const top=PAGE_H-MARGIN-18;
    const imageY=top-fit.height;
    page.drawRectangle({
      x:x-1.5,y:imageY-1.5,width:fit.width+3,height:fit.height+3,
      borderColor:rgb(0.2,0.2,0.2),borderWidth:0.7,color:rgb(1,1,1),
    });
    page.drawImage(photo,{x,y:imageY,width:fit.width,height:fit.height});
    photoBottom=imageY-16;
  }

  const name=safeText(resume.display_name||"Currículo");
  const headerWidth=photo?PAGE_W-MARGIN-116-MARGIN:PAGE_W-(MARGIN*2);
  const nameLines=wrapText(name,bold,31,headerWidth);
  for(const line of nameLines){
    page.drawText(line,{x:MARGIN,y,font:bold,size:31,color:DARK,maxWidth:headerWidth});
    y-=31;
  }

  if(resume.headline){
    y-=3;
    const lines=wrapText(safeText(resume.headline),bold,11.5,headerWidth);
    drawLines(lines,{x:MARGIN,maxWidth:headerWidth,font:bold,size:11.5,lineHeight:15,color:DARK});
  }

  if(resume.callout){
    y-=3;
    const calloutY=y;
    page.drawRectangle({x:MARGIN,y:calloutY-28,width:2.4,height:31,color:RED});
    const lines=wrapText(safeText(resume.callout),regular,10.2,headerWidth-14);
    drawLines(lines,{x:MARGIN+12,maxWidth:headerWidth-14,font:regular,size:10.2,lineHeight:13.5,color:MUTED});
  }

  if(photo)y=Math.min(y,photoBottom);
  y-=2;

  drawSection("Perfil",paragraphs(resume.summary));
  drawSection("Identidade & território",paragraphs(resume.identity_text));

  const experiences=Array.isArray(resume.experience)?resume.experience:[];
  if(experiences.some((item:any)=>item?.title||item?.role||item?.description)){
    drawRule();
    ensureSpace(48);
    const sectionStart=y;
    drawSectionHeading("Participações & projetos");
    y=sectionStart;

    for(const item of experiences){
      const title=safeText(item?.title);
      const role=safeText(item?.role);
      const description=safeText(item?.description);
      if(!title&&!role&&!description)continue;

      const titleLines=title?wrapText(title,bold,10.2,CONTENT_W-14):[];
      const roleLines=role?wrapText(role,bold,8.6,CONTENT_W-14):[];
      const descLines=description?wrapText(description,regular,9.2,CONTENT_W-14):[];
      const estimated=(titleLines.length*13)+(roleLines.length*11)+(descLines.length*12.5)+18;
      ensureSpace(Math.min(estimated,120));

      page.drawCircle({x:CONTENT_X+3,y:y+3,size:3,color:RED});
      if(titleLines.length)drawLines(titleLines,{x:CONTENT_X+14,maxWidth:CONTENT_W-14,font:bold,size:10.2,lineHeight:13,color:DARK});
      if(roleLines.length)drawLines(roleLines,{x:CONTENT_X+14,maxWidth:CONTENT_W-14,font:bold,size:8.6,lineHeight:11,color:RED});
      if(descLines.length)drawLines(descLines,{x:CONTENT_X+14,maxWidth:CONTENT_W-14,font:regular,size:9.2,lineHeight:12.5,color:MUTED});
      y-=9;
    }
  }

  const skills=Array.isArray(resume.skills)?resume.skills.map((item:any)=>safeText(item)).filter(Boolean):[];
  if(skills.length){
    ensureClosingSpace(310);
    drawRule();
    ensureSpace(70);
    const sectionStart=y;
    drawSectionHeading("Áreas de atuação");
    y=sectionStart;

    const gap=16;
    const colWidth=(CONTENT_W-gap)/2;
    const rowCount=Math.ceil(skills.length/2);
    for(let row=0;row<rowCount;row++){
      const left=skills[row*2]||"";
      const right=skills[row*2+1]||"";
      const leftLines=left?wrapText(left,bold,9.4,colWidth-18):[];
      const rightLines=right?wrapText(right,bold,9.4,colWidth-18):[];
      const maxLines=Math.max(leftLines.length,rightLines.length,1);
      const rowHeight=(maxLines*12.3)+7;
      ensureSpace(rowHeight+3);

      const items=[
        {value:left,lines:leftLines,x:CONTENT_X},
        {value:right,lines:rightLines,x:CONTENT_X+colWidth+gap},
      ];

      for(const item of items){
        if(!item.value)continue;
        page.drawCircle({x:item.x+3,y:y+3,size:2.5,color:RED});
        item.lines.forEach((line,lineIndex)=>{
          page.drawText(line,{
            x:item.x+13,
            y:y-(lineIndex*12.3),
            font:bold,
            size:9.4,
            color:DARK,
            maxWidth:colWidth-18,
          });
        });
      }
      y-=rowHeight;
    }
    y-=2;
  }

  const extraSections=Array.isArray(resume.extra_sections)?resume.extra_sections:[];
  for(const section of extraSections){
    const title=safeText(section?.title);
    const items=Array.isArray(section?.items)?section.items.map((item:any)=>safeText(item)).filter(Boolean):[];
    const content=safeText(section?.content);
    if(!title||(!items.length&&!content))continue;

    drawRule();
    ensureSpace(62);
    const sectionStart=y;
    drawSectionHeading(title);
    y=sectionStart;

    if(items.length){
      const gap=16;
      const colWidth=(CONTENT_W-gap)/2;
      const rowCount=Math.ceil(items.length/2);
      for(let row=0;row<rowCount;row++){
        const pair=[items[row*2]||"",items[row*2+1]||""];
        const lineSets=pair.map(value=>value?wrapText(value,bold,9,colWidth-18):[]);
        const rowHeight=(Math.max(lineSets[0].length,lineSets[1].length,1)*12)+7;
        ensureSpace(rowHeight+3);
        pair.forEach((value,index)=>{
          if(!value)return;
          const x=CONTENT_X+(index*(colWidth+gap));
          page.drawCircle({x:x+3,y:y+3,size:2.4,color:RED});
          lineSets[index].forEach((line,lineIndex)=>page.drawText(line,{x:x+13,y:y-(lineIndex*12),font:bold,size:9,color:DARK,maxWidth:colWidth-18}));
        });
        y-=rowHeight;
      }
    }
    if(content)drawParagraph(content);
    y-=2;
  }

  const contactRows=[
    ["E-mail",resume.contact_email],
    ["Contato",resume.contact_phone],
    ["Instagram",resume.instagram],
    ["LinkedIn",resume.linkedin_url],
    ["Portfólio",resume.website_url],
  ].map(([label,value])=>[label,safeText(value)] as [string,string]).filter(([,value])=>Boolean(value));

  if(contactRows.length){
    drawRule();
    ensureSpace(52);
    const sectionStart=y;
    drawSectionHeading("Contato");
    y=sectionStart;

    const colWidth=(CONTENT_W-10)/2;
    for(let i=0;i<contactRows.length;i+=2){
      ensureSpace(31);
      const row=contactRows.slice(i,i+2);
      const rowStart=y;
      row.forEach(([label,value],index)=>{
        const x=CONTENT_X+(index*(colWidth+10));
        page.drawText(label.toUpperCase(),{x,y:rowStart,font:bold,size:6.5,color:LIGHT,maxWidth:colWidth});
        const valueLines=wrapText(value,regular,8.6,colWidth);
        valueLines.slice(0,2).forEach((line,lineIndex)=>{
          page.drawText(line,{x,y:rowStart-12-(lineIndex*10.5),font:regular,size:8.6,color:DARK,maxWidth:colWidth});
        });
      });
      y-=34;
    }
  }

  drawRule();
  ensureSpace(145);
  const onlineSectionTop=y;
  drawSectionHeading("Currículo online");
  y=onlineSectionTop;

  const qrSize=88;
  const qrX=CONTENT_X;
  const qrY=y-qrSize+4;
  if(qr){
    page.drawRectangle({
      x:qrX-4,y:qrY-4,width:qrSize+8,height:qrSize+8,
      color:rgb(1,1,1),
      borderColor:rgb(0.82,0.82,0.82),
      borderWidth:0.6,
    });
    page.drawImage(qr,{x:qrX,y:qrY,width:qrSize,height:qrSize});
  }

  const onlineTextX=qr?CONTENT_X+108:CONTENT_X;
  const onlineTextW=qr?CONTENT_W-108:CONTENT_W;
  let onlineTextY=y;

  const onlineTitle="Acompanhe a versão atualizada deste currículo";
  const onlineTitleLines=wrapText(onlineTitle,bold,10.5,onlineTextW);
  for(const line of onlineTitleLines){
    page.drawText(line,{x:onlineTextX,y:onlineTextY,font:bold,size:10.5,color:DARK,maxWidth:onlineTextW});
    onlineTextY-=13.5;
  }

  onlineTextY-=4;
  const onlineDescription="Escaneie o QR Code para acessar o currículo online e consultar sempre a versão mais recente.";
  const onlineDescriptionLines=wrapText(onlineDescription,regular,9.1,onlineTextW);
  for(const line of onlineDescriptionLines){
    page.drawText(line,{x:onlineTextX,y:onlineTextY,font:regular,size:9.1,color:MUTED,maxWidth:onlineTextW});
    onlineTextY-=12.2;
  }

  onlineTextY-=5;
  const displayOnlineUrl=safeText(onlineUrl.replace(/^https?:\/\//,""));
  const onlineUrlLines=wrapText(displayOnlineUrl,regular,7.3,onlineTextW);
  for(const line of onlineUrlLines.slice(0,3)){
    page.drawText(line,{x:onlineTextX,y:onlineTextY,font:regular,size:7.3,color:RED,maxWidth:onlineTextW});
    onlineTextY-=9.5;
  }

  y=Math.min(qrY-14,onlineTextY-6);

  const updated=resume.updated_at?new Date(resume.updated_at):null;
  const updatedLabel=updated&&!Number.isNaN(updated.getTime())
    ?new Intl.DateTimeFormat("pt-BR",{month:"short",year:"numeric"}).format(updated).replace(".","")
    :"";

  pages.forEach((current:any,index:number)=>{
    current.drawLine({
      start:{x:MARGIN,y:28},end:{x:PAGE_W-MARGIN,y:28},
      thickness:0.5,color:rgb(0.84,0.84,0.84),
    });
    current.drawText(safeText(resume.display_name||"Currículo"),{
      x:MARGIN,y:16,font:regular,size:6.5,color:LIGHT,maxWidth:220,
    });
    if(updatedLabel){
      current.drawText("Atualizado em "+safeText(updatedLabel),{
        x:(PAGE_W/2)-36,y:16,font:regular,size:6.5,color:LIGHT,maxWidth:100,
      });
    }
    const pageNumber=(index+1)+"/"+pages.length;
    const numberWidth=regular.widthOfTextAtSize(pageNumber,6.5);
    current.drawText(pageNumber,{
      x:PAGE_W-MARGIN-numberWidth,y:16,font:regular,size:6.5,color:LIGHT,
    });
  });

  pdf.setTitle(safeText(resume.seo_title||resume.display_name||"Currículo"));
  pdf.setAuthor(safeText(resume.display_name||""));
  pdf.setSubject(safeText(resume.seo_description||resume.headline||"Currículo profissional"));
  pdf.setCreator("Sagamente");

  return await pdf.save();
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="GET")return json("Método não permitido",405);

  const slug=new URL(req.url).searchParams.get("slug")?.trim();
  if(!slug)return json("Slug obrigatório");

  try{
    const resume=await fetchResume(slug);
    if(!resume)return json("Currículo não encontrado",404);

    const site=(Deno.env.get("PUBLIC_SITE_URL")||"https://playsistem-oficial.playmomentsstudios.workers.dev").replace(/\/$/,"");
    const onlineUrl=site+"/curriculos/"+encodeURIComponent(slug)+"/";
    const bytes=await buildResumePdf(resume,onlineUrl);
    return new Response(bytes,{
      status:200,
      headers:{
        ...corsHeaders,
        "Content-Type":"application/pdf",
        "Content-Disposition":'attachment; filename="'+filename(resume.display_name)+'"',
        "Cache-Control":"private, no-store, max-age=0",
        "X-Content-Type-Options":"nosniff",
      },
    });
  }catch(error){
    console.error("[resume-pdf]",error);
    return json(error instanceof Error?error.message:"Falha ao gerar PDF",500);
  }
});
