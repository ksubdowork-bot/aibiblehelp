// Code.gs — same backend; job/interests optional. Front-end no longer sends them.
const SHEET_NAMES = { personas:'Personas', questions:'Questions', background:'Background' };

function getSheet_(n){ return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function readTable_(s){ const v=s.getDataRange().getValues(); const [h,...r]=v; return r.map(row=>Object.fromEntries(h.map((k,i)=>[String(k).trim(), row[i]]))); }

function buildBackground_(){ const s=getSheet_(SHEET_NAMES.background); if(!s) return ''; return readTable_(s).map(r=>`${r.Key}: ${r.Value}`).join('\n'); }
function getTemplates_(){
  const s=getSheet_(SHEET_NAMES.background); if(!s) return { header:'요약', sections:['핵심 포인트','다음 행동'], bullets:3 };
  const kv=Object.fromEntries(readTable_(s).map(r=>[r.Key, r.Value]));
  return { header: kv['template.header']||'요약', sections: String(kv['template.sections']||'핵심 포인트;다음 행동').split(';').map(x=>x.trim()).filter(Boolean), bullets: parseInt(kv['template.bullets_per_section']||'3',10) };
}

function getPersonaByAge_(age){
  const s=getSheet_(SHEET_NAMES.personas); if(!s) return null; const rows=readTable_(s);
  return rows.find(r=>String(r.AgeGroup).trim()===String(age).trim()) || null;
}

function getQuestionsByAge_(age){
  const s=getSheet_(SHEET_NAMES.questions); if(!s) return [];
  return readTable_(s).filter(r=>String(r.AgeGroup).trim()===String(age).trim() && String(r.Enabled).toLowerCase()==='true')
    .map(r=>({ id:r.QuestionID, text:r.QuestionText, category:r.Category||'' }));
}

// GET /exec?age=20대
function doGet(e){
  const p=e&&e.parameter||{};
  const age=p.age||'';
  const persona=getPersonaByAge_(age) || {};
  const background=buildBackground_(); const questions=getQuestionsByAge_(age); const tmpl=getTemplates_();
  return ContentService.createTextOutput(JSON.stringify({ age, persona, background, questions, template: tmpl }))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST { age, userMessage, selectedQuestions:[..], history, model }
function doPost(e){
  try{
    const props=PropertiesService.getScriptProperties();
    const OPENAI_API_KEY=props.getProperty('OPENAI_API_KEY'); if(!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    const body=JSON.parse(e.postData.contents);
    const { age, userMessage='', selectedQuestions=[], history=[], model='gpt-4o-mini' } = body;

    const persona=getPersonaByAge_(age) || {};
    const background=buildBackground_();
    const tmpl=getTemplates_();

    const systemPrompt=[ '[BACKGROUND]', background, '\n[PERSONA]', persona.SystemPrompt||'', '\n[TEMPLATE]', `header: ${tmpl.header}`, `sections: ${tmpl.sections.join('; ')}`, `bullets_per_section: ${tmpl.bullets}` ].join('\n');
    const messages=[ { role:'system', content: systemPrompt } ];
    history.forEach(m=>{ if(m&&m.role&&m.content) messages.push({role:m.role, content:m.content}); });
    const qBlock = Array.isArray(selectedQuestions)&&selectedQuestions.length>0 ? selectedQuestions.map((q,i)=>`Q${i+1}: ${q}`).join('\n') : '';
    const userCombined=[ qBlock, userMessage && `사용자 입력: ${userMessage}` ].filter(Boolean).join('\n');
    messages.push({ role:'user', content: userCombined || '질문을 입력해 주세요.' });

    const payload={ model, messages, temperature:0.3 };
    const res=UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions',{ method:'post', contentType:'application/json', headers:{ Authorization:`Bearer ${OPENAI_API_KEY}` }, payload:JSON.stringify(payload), muteHttpExceptions:true });
    const status=res.getResponseCode(); const json=JSON.parse(res.getContentText());
    if(status>=200&&status<300){
      const reply=json.choices?.[0]?.message?.content||'';
      return ContentService.createTextOutput(JSON.stringify({ reply, usage: json.usage||null, template: tmpl }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error(`OpenAI error ${status}: ${res.getContentText()}`);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ error:String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
