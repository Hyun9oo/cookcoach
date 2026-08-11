# CookCoach 요구사항

## 확정 요구사항

- 첫 화면은 자동으로 넘어가지 않고 사용자가 눌러서 시작한다.
- 냉장고 촬영 후 영수증 촬영 단계로 이어진다.
- 각 촬영 단계는 건너뛸 수 있다.
- 냉장고와 영수증을 모두 건너뛰면 데모 냉장고를 사용한다.
- 재료를 자유롭게 추가할 수 있다.
- 찜한 메뉴를 확인할 수 있다.
- 모든 9개 메뉴 구조를 지원한다.
- 준비/조리 과정별 이미지 영역을 제공한다.
- `[공유링크 복사했어요]` 기능과 문구를 제거한다.
- `[문제가 생겼어요]`를 `[도와주세요!]`로 변경한다.
- `도와주세요!`에서 카메라 촬영이 가능해야 한다.
- 건강 목표를 사용자가 직접 추가할 수 있어야 한다.
- 작동하지 않는 버튼은 제거하거나 실제 동작을 구현한다.
- 백그라운드 디자인을 개선한다.
- 모바일 환경과 Netlify 정적 배포에 대응한다.
- 9개 레시피의 음식 완성 이미지와 과정 이미지를 실제 정적 자산 경로로 연결한다.

## 이미지 요구사항

- `assets/recipes/`의 9개 레시피별 `hero.png`와 실제 STEP 수만큼의 `step-01.png` 이후 파일을 사용한다.
- 웹 이미지나 임시 외부 이미지를 사용하지 않는다.
- 추천 메뉴 카드, 전체 메뉴, 메뉴 상세, COACH, REVIEW와 리포트는 레시피의 공통 `heroPath` 또는 `steps[].image` source를 사용한다.
- 이미지 로드 성공 시 실제 이미지를 표시하고 placeholder를 숨긴다.
- 이미지 파일이 없거나 로드에 실패하면 CookCoach UI 스타일의 placeholder를 표시하며 broken image 아이콘을 노출하지 않는다.
- 이미지는 원본 파일을 변환하지 않고 `object-fit: cover`, `object-position: center`로 표시한다.

## 리마인드 설정 요구사항

- 알림 Bottom Sheet에서 요리 시작 시간, 주간 영양 리포트 요일·시간, 냉장고 재촬영 주기를 사용자가 변경할 수 있다.
- 기본값은 요리 시작 `18:00`, 주간 영양 리포트 `일요일 21:00`, 냉장고 재촬영 `7일마다`다.
- 냉장고 재촬영 주기는 1~30일로 제한한다.
- 설정은 `cookcoach.reminders.v1` localStorage 객체에 저장하고 새로고침 후 복원한다.
- 현재 구현은 앱 안에서 설정값을 저장·표시하는 프로토타입이며 실제 Web Push, 백그라운드 또는 OS 알림을 전송하지 않는다.

## 단계별 `도와주세요!` 요구사항

- 9개 레시피의 56개 모든 STEP에서 현재 단계의 대표적인 조리 문제 1개와 해결 가이드 1개를 제공한다.
- 도움말 Bottom Sheet는 현재 STEP의 대표 질문·답변 다음에 사용자의 자유 질문 입력 영역을 제공한다.
- 자유 질문은 빈 문자열과 공백만으로 제출할 수 없으며, 제출 후에도 Bottom Sheet와 작성한 질문을 유지한다.
- 자유 질문 응답은 실제 생성형 AI, 검색엔진 또는 전문가 상담 결과가 아니다. 향후 단계별 도움말 개선에 참고한다는 공통 안내만 표시한다.
- 공통 안내는 하나의 상수에서 관리하며 같은 Bottom Sheet 안에서 중복 추가하지 않는다.

## 9개 레시피 이미지 구현 상태

| recipe id | hero | STEP 이미지 | 레시피 STEP | 상태 |
| --- | --- | ---: | ---: | --- |
| `solo-simple-tofu-inari` | `assets/recipes/solo-simple-tofu-inari/hero.png` | 5 | 5 | 연결 완료 |
| `solo-balanced-shrimp-poke` | `assets/recipes/solo-balanced-shrimp-poke/hero.png` | 6 | 6 | 연결 완료 |
| `solo-fancy-salmon-gnocchi` | `assets/recipes/solo-fancy-salmon-gnocchi/hero.png` | 6 | 6 | 연결 완료 |
| `duo-simple-gyudon` | `assets/recipes/duo-simple-gyudon/hero.png` | 6 | 6 | 연결 완료 |
| `duo-balanced-beef-shabu-shabu` | `assets/recipes/duo-balanced-beef-shabu-shabu/hero.png` | 6 | 6 | 연결 완료 |
| `duo-fancy-garlic-butter-shrimp-lemon-pasta` | `assets/recipes/duo-fancy-garlic-butter-shrimp-lemon-pasta/hero.png` | 6 | 6 | 연결 완료 |
| `guest-simple-gambas` | `assets/recipes/guest-simple-gambas/hero.png` | 6 | 6 | 연결 완료 |
| `guest-balanced-tofu-vegetable` | `assets/recipes/guest-balanced-tofu-vegetable/hero.png` | 7 | 7 | 연결 완료 |
| `guest-fancy-pork-roll` | `assets/recipes/guest-fancy-pork-roll/hero.png` | 8 | 8 | 연결 완료 |

## Phase 1 작업 범위

1. 기존 HTML 및 DOCX 분석
2. 원본 HTML 백업
3. Markdown Source of Truth 구조 생성
4. 둘이서 레시피 3종 정확한 구조화
5. 규동 Golden Path 문서화
6. 기존 앱 기능과 문제점 파악
7. 첫 화면 자동 전환 제거 및 수동 시작 적용
8. 기본 작동 여부 확인

## 이번 작업에서 제외

- 음식 완성 이미지 및 과정별 이미지 생성
- 외부 음식 이미지 검색
- 새로운 프레임워크 도입
- 실제 AI Vision API 연결
- 상세 원본이 확정되지 않은 레시피 생성
- 기존 앱 전체 재작성
- SCAN 최종 흐름의 대규모 재구현

## 기존 프로토타입 구현 분석

### 구현된 화면

- 홈/촬영
- 촬영 결과 재료 확인
- 보유 재료
- 상황·콘셉트 선택과 메뉴 추천
- 전체 메뉴 목록
- 메뉴 상세
- 단계별 COACH
- 요리 완료/REVIEW
- 마이페이지와 식사 캘린더
- 월간 영양 리포트
- 수량 입력, 재료 추가, 과정 보기, 도움말, 알림, 건강 목표 bottom sheet

### 구현된 동작

- 브라우저 카메라 요청, 촬영 프레임 캡처, TensorFlow.js/COCO-SSD 기반 제한적 물체 인식과 데모 결과 fallback
- 냉장고/영수증 모드 전환
- 인식 재료의 수량 수정·추가·삭제와 보유 재료 반영
- 상황 3종 × 콘셉트 3종의 9개 메뉴 추천 구조
- 메뉴 찜 토글
- 단계 이동, 단계별 타이머, 과정 목록, 도움말 FAQ
- 요리 완료 후 재료 차감, 식사 기록, 캘린더와 리포트 화면 반영
- 데모 초기화

### 미구현 또는 프로토타입 동작

- 영수증 OCR: 현재 영수증 결과는 데모 데이터다.
- 찜한 메뉴 전용 목록
- `도와주세요!` 카메라 촬영과 사진 기반 상태 확인
- 건강 목표 직접 입력: Phase 3에서 기본 목표 선택과 자유 목표 추가·삭제·영구 저장을 구현했다.
- 공유, 메모, 달력 날짜 선택: 현재 일부 버튼은 안내 toast만 표시한다.
- 찜 상태의 브라우저 영구 저장
- 9개 레시피의 최종 이미지 경로 전환: `assets/recipes/`의 PNG 자산과 공통 renderer 연결을 완료했다.

### 데이터 및 코드 위험

- `index.html`이 약 2MB인 단일 파일이며 CSS, JavaScript, 대량의 base64 이미지가 결합되어 있다.
- TensorFlow.js와 COCO-SSD를 외부 CDN에서 불러오므로 네트워크가 없으면 실제 인식 모델을 사용할 수 없다.
- Phase 2에서 규동 화면 데이터와 STEP별 `도와주세요!`는 Word 원본에 동기화했다. 소고기 채소 샤브샤브와 갈릭버터 새우 레몬 파스타 화면 데이터는 아직 원본보다 축약되어 있다.
- 영양 수치와 리포트 일부는 데모용 하드코딩 값이다. 캘린더 기록은 Phase 3부터 현재 날짜 기준 상대 데모 기록과 실제 완료 기록을 함께 사용한다.
- Phase 2 반응형 보완으로 430px 이하에서는 고정 휴대폰 프레임과 body 여백을 제거한다. 실제 기기별 safe area와 카메라 권한 동작은 추가 브라우저 테스트가 필요하다.
- inline 이벤트 핸들러와 전역 상태가 많아 부분 수정 시 회귀 범위가 넓다.
- 사용되지 않는 과거 화면용 CSS와 현재 화면용 CSS가 함께 남아 있어 중복·정리 위험이 있다.

## Phase 2 실제 브라우저 QA 확정 요구사항

- SCAN은 반드시 냉장고 → 영수증 순서로 진행한다.
- 냉장고 촬영 후 바로 재료 확인으로 가지 않고 영수증 단계를 제공한다.
- 냉장고와 영수증을 모두 촬영할 수 있고 각 단계는 독립적으로 건너뛸 수 있다.
- 둘 다 건너뛰면 데모 냉장고 안내를 표시한다.
- 규동 데모 냉장고에는 소고기 200g을 포함한 원본 핵심 재료가 모두 있어야 한다.
- 필수 재료가 부족하면 메뉴 상세에서 필요한 재료와 수량을 표시하고 요리 시작을 제한한다.
- 추천 재료 선택과 재료명·수량·단위 자유 입력 방식이 함께 있어야 한다.
- 직접 추가 재료도 수량 증가·감소·수정, 단위 수정, 삭제가 가능해야 한다.
- COACH의 중복된 큰 `다음 단계` 버튼을 제거한다.
- 하단 단계 이동은 `이전 단계`와 `다음 단계` 텍스트 버튼을 사용한다.
- STEP 1의 이전 단계 버튼은 disabled 상태여야 한다.
- 마지막 STEP은 `요리 완성하기`로 표시한다.
- `도와주세요!`는 현재 메뉴와 현재 STEP에 연결된 도움말을 먼저 표시한다.
- 규동 STEP 1~6 도움말은 `DUO_RECIPES.md`와 일치해야 한다.
- 캘린더 날짜를 선택하면 해당 날짜의 실제 메뉴 기록 전체를 표시한다.
- 같은 날짜에 두 개 이상의 식사 기록을 저장하고 모두 표시할 수 있어야 한다.
- 재료 목록, 직접 추가 재료, 식사 완료 기록은 localStorage에 저장한다.
- 이미지가 없거나 로드에 실패하면 broken image 아이콘 대신 CookCoach placeholder를 표시한다.
- 규동 이미지는 `assets/recipes/duo-simple-gyudon/`의 고정 경로를 사용한다.

## Phase 2 구현 상태

- 냉장고/영수증 4개 조합과 결과 병합 구현
- 둘 다 건너뛰기용 데모 냉장고 안내 및 규동 원본 계량 적용
- 규동 필수 재료 판정과 시작 버튼 제한 구현
- 추천 재료와 자유 입력, 수량 및 단위 편집 구현
- 규동 레시피 6단계 설명과 단계별 도움말 원본 동기화
- COACH 이전/다음 텍스트 버튼과 마지막 완료 버튼 구현
- 식사 기록 구조 및 날짜별 복수 메뉴 표시 구현
- 재료와 식사 기록 localStorage 저장 구현
- 규동 hero/STEP/REVIEW 경로 기반 이미지와 placeholder fallback 구현

## Phase 2 남은 범위

- 실제 영수증 OCR
- `도와주세요!` 사진 촬영과 상태 분석
- 규동 외 메뉴의 상세 원본 동기화
- 찜 상태 localStorage 저장과 찜 목록 화면
- 안내 toast만 있는 공유·메모·날짜 선택 버튼 정리
- 실제 모바일 브라우저와 카메라 권한 환경에서의 최종 회귀 테스트

## Phase 3 실제 브라우저 QA 확정 요구사항

- 규동 추천 카드, 전체 메뉴 목록, 메뉴 상세, REVIEW와 향후 찜 목록은 동일한 `assets/recipes/duo-simple-gyudon/hero.png` 경로를 사용한다.
- 규동 hero 파일이 없거나 로드에 실패하면 `규동 · 메뉴 이미지 준비 중` placeholder를 표시한다.
- `도와주세요!`의 대표 질문 외 문제 영역은 사용자 직접 입력을 제공한다.
- 직접 입력 질문에는 실제 생성형 답변을 만들지 않고, 향후 단계별 도움말 개선에 참고한다는 공통 안내를 표시한다.
- 식사 기록이 비어 있고 데모 seed가 생성되지 않았을 때만 최근 날짜에 상대 데모 기록을 한 번 생성한다.
- 데모 기록은 `isDemo: true`, 실제 완료 기록은 `isDemo: false`로 구분한다.
- 기존 식사 기록을 데모 기록으로 덮어쓰지 않는다.
- 사용자는 프로필 이름과 사진을 변경할 수 있고 새로고침 후에도 유지되어야 한다.
- 프로필 사진은 중앙 정사각형 crop, 최대 256×256 JPEG 압축 후 저장하며 대용량 원본을 그대로 저장하지 않는다.
- 카메라 오류의 `name`, `message`, secure context 여부를 콘솔에 기록하고 오류 종류별 사용자 안내를 표시한다.
- 카메라 실패 시 다시 시도, 사진 선택, 건너뛰기를 제공한다.
- 냉장고 촬영 완료 시 stream track과 video 연결을 해제하고 영수증에서 새 stream을 요청한다.
- 기본 건강 목표와 직접 입력 목표가 공존하며 선택·해제·직접 목표 삭제와 localStorage 저장을 지원한다.

## Phase 3 구현 상태

- 9개 레시피 공통 hero/STEP source와 재사용 가능한 렌더링 함수 제공
- 9개 레시피 56개 STEP의 대표 질문·답변과 사용자 직접 질문 안내 UX 구현
- 최근 6일 상대 날짜 데모 식사 기록 7개 및 하루 복수 기록 구현
- 이름 수정과 256×256 압축 프로필 사진 localStorage 저장 구현
- 카메라 미리보기/촬영 분리, 오류별 진단, stream 완전 해제, 재시도·사진 선택·건너뛰기 구현
- 기본·직접 건강 목표의 복수 선택, 중복 방지, 삭제와 영구 저장 구현

## Phase 3 남은 범위

- 실제 모바일 Safari/Chrome의 카메라 권한과 후면 카메라 선택 회귀 테스트
- `도와주세요!` 사진 촬영과 실제 상태 분석
- 실제 AI API와 영수증 OCR
- 찜 메뉴 전용 목록 화면

## Phase 4 카메라 QA 확정 요구사항

- 냉장고와 영수증 촬영은 동일한 camera controller를 사용한다.
- 카메라는 `facingMode: environment`를 우선 요청하되, 장치 선택 또는 제약 오류가 나면 `video: true`로 기본 카메라를 다시 요청한다.
- 권한 거부·보안 환경·API 미지원처럼 카메라 선택을 바꿔도 해결되지 않는 오류는 중복 권한 요청 없이 바로 안내한다.
- 후면 우선 요청과 기본 카메라 요청이 모두 실패하면 사진 선택·다시 시도·건너뛰기를 제공한다.
- 각 요청 실패의 `error.name`, `error.message`, 사용한 constraints를 개발자 콘솔에 기록한다.
- 카메라 오류 안내는 중앙 팝업 대신 화면 아래에서 올라오는 bottom sheet로 표시한다.
- 초기 camera sheet 요구는 handle 클릭과 위·아래 swipe로 펼침/접힘이었으나, 아래 전역 Bottom Sheet 요구사항의 `handle 클릭 닫기`와 `아래 drag dismiss`로 대체한다.
- 촬영 단계가 끝나면 MediaStream의 모든 track을 중지하고 video 연결을 해제한 뒤 다음 촬영에서 새 stream을 요청한다.

## Phase 4 구현 상태

- 후면 우선 → 기본 카메라의 2단계 getUserMedia 요청과 요청별 오류 기록 구현
- 권한·보안·미지원 오류의 불필요한 재요청 방지 구현
- 사진 선택·다시 시도·건너뛰기를 포함한 camera bottom sheet 구현
- 초기 camera sheet 펼침/접힘 구현은 아래 공통 controller의 닫기 interaction으로 대체

## Phase 4 전역 Bottom Sheet·카메라 재진단 확정 요구사항

- 회색 drag handle이 있는 모든 하단 sheet는 하나의 공통 controller를 사용한다.
- 대상은 재료 수량·추가·단위, 과정 보기, `도와주세요!`, 데모 냉장고, 날짜별 식사, 알림, 건강목표, 프로필, 카메라 오류 sheet다.
- handle은 약 44px 이상의 터치 영역을 가지며 클릭하면 sheet가 아래로 내려가며 닫힌다.
- touch·mouse·pen drag를 지원하고, sheet 높이의 약 25% 또는 충분한 하향 속도와 거리를 넘었을 때만 닫힌다.
- 닫힘 기준 미만의 drag는 열린 위치로 부드럽게 복귀하며 위쪽 방향으로는 이동하지 않는다.
- sheet 내부 스크롤을 우선하고, scrollTop이 0인 콘텐츠에서 아래로 drag할 때만 dismiss를 시작한다.
- backdrop 클릭으로 닫을 수 있고, bottom navigation보다 sheet와 backdrop이 위에 표시되어야 한다.
- 긴 sheet는 제한된 최대 높이 안에서 콘텐츠 영역이 스크롤되며 하단 버튼은 safe area에 가리지 않아야 한다.
- 데스크톱은 `{ video: true, audio: false }`를 첫 카메라 요청으로 사용한다.
- 모바일은 후면 선호 요청 후 실패 시 기본 카메라 요청으로 fallback한다.
- 카메라 요청 전과 실패 후 protocol, hostname, secure context, mediaDevices, getUserMedia, enumerateDevices, videoInput 수와 각 attempt를 console에 기록한다.
- videoInput 0개, 권한 거부, 카메라 사용 중, 카메라 감지 후 시작 실패를 서로 다른 사용자 메시지로 안내한다.

## Phase 4 전역 Bottom Sheet·카메라 재진단 구현 상태

- handle 기반 표준 sheet 10개와 카메라 오류 sheet를 공통 controller로 통합
- handle 클릭, Pointer Events 기반 mouse·pen drag, 모바일 touch drag, threshold·속도 판정과 snap-back 구현
- 내부 scrollTop 및 interactive control 충돌 방지와 backdrop 공통 dismiss 구현
- sheet·backdrop을 bottom navigation보다 위로 올리고 safe area·최대 높이·콘텐츠 스크롤 적용
- 데스크톱 기본 카메라 우선, 모바일 후면 선호 → 기본 카메라 fallback 구현
- enumerateDevices 기반 videoInput 진단과 오류별 안내 구현

## GitHub Pages 모바일·기록 흐름 확정 요구사항

- 실제 모바일에서는 고정 390×844 phone shell 제한을 제거하고 `100dvh`, `safe-area-inset-top`, `safe-area-inset-bottom`을 사용한다.
- 하단 navigation, CTA, camera controls, bottom sheet가 Safari 하단 UI와 홈 인디케이터에 가려지거나 서로 겹치지 않아야 한다.
- SCAN 안내는 촬영 프레임 상단의 작고 반투명한 overlay로 표시해 피사체를 가리지 않는다.
- 추천 headline은 실제 대표 카드 수와 선택 콘셉트를 사용하며 여러 메뉴의 서로 다른 조리시간을 하나로 묶어 말하지 않는다.
- 9개 메뉴의 56개 모든 STEP은 확정된 대표 문제·해결을 하나씩 연결한다. 기존 둘이서 3개 메뉴의 18개 도움말 문구는 변경하지 않는다.
- 건강 목표는 체중 감량, 저나트륨, 저당, 채식 위주, 고단백별로 서로 다른 요약과 확인 기준을 표시한다. 직접 목표는 사용자 문구를 기반으로 일반적인 기록 안내만 제공한다.
- 스트릭은 식사 기록 날짜의 중복을 제거한 뒤 오늘 또는 가장 최근 기록일부터 연속된 날짜 수를 계산하며 월 경계를 허용한다.
- `오늘의 한 끼 기록하기`는 완료 1회당 식사 기록을 한 번만 저장하고 마이페이지를 활성화하며 오늘 캘린더에 메뉴명을 표시한다.

## GitHub Pages 모바일·기록 흐름 구현 상태

- 모바일 full viewport와 safe area 대응, SCAN 안내 위치·투명도 조정 완료
- 선택 콘셉트와 대표 카드 수를 사용하는 추천 headline 적용 완료
- 나를 위해·둘이서·손님과 함께 각 3개, 총 9개 메뉴의 원문 STEP 도움말 연결 완료
- 건강 목표별 요약·확인 기준 분리 및 직접 목표 일반 추적 문구 적용 완료
- 날짜 중복 제거와 오늘/최근 기록 anchor 기반 스트릭 계산 완료
- 완료 token 기반 식사 중복 저장 방지, 저장 후 마이페이지 이동과 오늘 메뉴 반영 완료
- `assets/recipes/`의 9개 레시피 hero/STEP PNG를 추천·상세·COACH·REVIEW 공통 renderer에 연결 완료

## GitHub Pages 모바일·기록 흐름 남은 범위

- 실제 iPhone Safari에서 카메라 권한 허용·거부와 후면 카메라 선택 최종 확인
- 실제 AI 상태 분석과 영수증 OCR
