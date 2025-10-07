# Persona Q&A WebApp — Checkbox Questions

변경점:
- 직업/관심사 입력 제거
- 추천 질문을 체크박스 목록으로 표시. 복수 선택 가능
- 프런트는 선택 항목을 selectedQuestions 배열로 전송

사용:
1) Apps Script에 Code.gs 배포, 키 설정
2) index.html의 APPS_SCRIPT_URL 교체
3) 시트(Questions)에 AgeGroup/QuestionText/Category/Enabled 준비
