(function () {
  'use strict';

  const USER_STORAGE_KEY = 'cookcoach.user.v1';
  const MAX_PROFILE_NAME_LENGTH = 20;
  const MAX_HEALTH_GOAL_LENGTH = 30;
  const PROFILE_IMAGE_SIZE = 256;
  const DEFAULT_PROFILE_IMAGE = 'assets/default-profile.svg';
  const CUSTOM_HELP_ACKNOWLEDGEMENT = [
    '질문 남겨주셔서 고마워요!',
    '쿡코치가 더 좋은 답을 드릴 수 있도록 조금 더 고민해볼게요.',
    '남겨주신 내용은 앞으로 단계별 도움말을 더 정확하게 만드는 데 참고할게요!'
  ].join('\n');
  const phase2Capture = window.capture;
  const phase2SkipCurrentScan = window.skipCurrentScan;
  const phase2RestartScanFlow = window.restartScanFlow;

  const DEFAULT_GOALS = [
    {
      id: 'lose', label: '체중 감량', description: '하루 1,800kcal · 단백질 70g',
      summary: '식사 기록을 기준으로 한 끼 열량과 단백질 균형을 함께 살펴봐요.',
      criteria: ['🍽 한 끼 열량 범위 살펴보기', '🥩 단백질 70g 목표 확인', '📅 직접 요리한 날 꾸준히 기록']
    },
    {
      id: 'sodium', label: '저나트륨 식단', description: '나트륨 2,000mg 이하',
      summary: '소스와 국물 사용 기록을 중심으로 나트륨 섭취 경향을 살펴봐요.',
      criteria: ['🧂 나트륨 2,000mg 이하 지향', '🥣 국물·소스 섭취 빈도 확인', '🌿 허브·향신료 활용 메뉴 살펴보기']
    },
    {
      id: 'sugar', label: '저당 식단', description: '당류 50g 이하',
      summary: '단맛이 강한 소스와 음료 기록을 중심으로 당류 섭취 경향을 살펴봐요.',
      criteria: ['🍬 당류 50g 이하 지향', '🥤 단 음료·소스 기록 확인', '🥗 식이섬유가 있는 식사 살펴보기']
    },
    {
      id: 'veggie', label: '채식 위주 식단', description: '채소·식물성 단백 중심',
      summary: '채소와 식물성 단백질이 포함된 한 끼의 빈도를 살펴봐요.',
      criteria: ['🥬 채소가 포함된 한 끼 기록', '🫘 식물성 단백질 메뉴 확인', '🌈 다양한 채소 구성 살펴보기']
    },
    {
      id: 'protein', label: '고단백 식단', description: '단백질 120g 이상',
      summary: '끼니별 단백질 메뉴 기록과 전체 식사 균형을 함께 살펴봐요.',
      criteria: ['🥩 단백질 120g 목표 확인', '🍳 끼니별 단백질 메뉴 기록', '⚖️ 채소·탄수화물과 균형 살펴보기']
    }
  ];

  let cameraRequest = null;
  let lastCameraMode = '';
  let lastCameraDiagnostics = null;
  let userProfile = loadUserProfile();

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function defaultUserProfile() {
    return {
      name: 'Lilya',
      profileImage: '',
      healthGoals: DEFAULT_GOALS.map(goalOption => ({
        id: goalOption.id,
        label: goalOption.label,
        description: goalOption.description,
        summary: goalOption.summary,
        criteria: goalOption.criteria.slice(),
        custom: false,
        selected: goalOption.id === 'lose'
      }))
    };
  }

  function normalizeUserProfile(value) {
    const fallback = defaultUserProfile();
    if (!value || typeof value !== 'object') return fallback;
    const existingGoals = Array.isArray(value.healthGoals) ? value.healthGoals : [];
    const builtInGoals = DEFAULT_GOALS.map(option => {
      const stored = existingGoals.find(item => item && item.id === option.id);
      return {
        id: option.id,
        label: option.label,
        description: option.description,
        summary: option.summary,
        criteria: option.criteria.slice(),
        custom: false,
        selected: stored ? Boolean(stored.selected) : option.id === 'lose'
      };
    });
    const customGoals = existingGoals
      .filter(item => item && item.custom && typeof item.label === 'string' && item.label.trim())
      .map(item => ({
        id: String(item.id || `custom-${Date.now()}`),
        label: item.label.trim().slice(0, MAX_HEALTH_GOAL_LENGTH),
        description: '직접 추가한 목표',
        summary: `${item.label.trim().slice(0, MAX_HEALTH_GOAL_LENGTH)}을 꾸준히 실천할 수 있도록 요리 기록을 중심으로 살펴봐요.`,
        criteria: ['📝 목표와 관련된 한 끼 기록 남기기', '📅 실천한 날짜를 캘린더에서 확인', '🔎 기록의 흐름을 참고용으로 살펴보기'],
        custom: true,
        selected: Boolean(item.selected)
      }));
    return {
      name: typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, MAX_PROFILE_NAME_LENGTH)
        : fallback.name,
      profileImage: typeof value.profileImage === 'string' ? value.profileImage : '',
      healthGoals: builtInGoals.concat(customGoals)
    };
  }

  function loadUserProfile() {
    try {
      return normalizeUserProfile(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null'));
    } catch (error) {
      console.warn('[CookCoach profile] 저장된 프로필을 읽지 못했습니다.', error);
      return defaultUserProfile();
    }
  }

  function persistUserProfile(candidate) {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(candidate));
      return true;
    } catch (error) {
      console.error('[CookCoach profile] 프로필 저장 실패', error);
      return false;
    }
  }

  function renderProfile() {
    const name = document.getElementById('profileName');
    const image = document.getElementById('profileImage');
    if (name) name.textContent = userProfile.name;
    if (!image) return;

    const loadProfileSource = (source, allowDefaultFallback, isCustomSource) => {
      image.hidden = true;
      image.classList.toggle('is-custom-profile', Boolean(isCustomSource));
      image.onload = () => { image.hidden = false; };
      image.onerror = () => {
        if (allowDefaultFallback) loadProfileSource(DEFAULT_PROFILE_IMAGE, false, false);
        else image.hidden = true;
      };
      image.src = source;
      if (image.complete && image.naturalWidth) image.hidden = false;
    };

    const hasCustomImage = Boolean(userProfile.profileImage);
    image.alt = hasCustomImage ? `${userProfile.name} 프로필 사진` : 'CookCoach 기본 프로필';
    loadProfileSource(hasCustomImage ? userProfile.profileImage : DEFAULT_PROFILE_IMAGE, hasCustomImage, hasCustomImage);
  }

  window.openProfileEditor = function () {
    document.getElementById('profileNameInput').value = userProfile.name;
    openSheet('sheet-profile');
  };

  window.saveProfile = function () {
    const input = document.getElementById('profileNameInput');
    const nextName = input.value.trim();
    if (!nextName) {
      toast('이름을 입력해 주세요');
      input.focus();
      return;
    }
    const candidate = Object.assign({}, userProfile, { name: nextName.slice(0, MAX_PROFILE_NAME_LENGTH) });
    if (!persistUserProfile(candidate)) {
      toast('프로필을 저장하지 못했어요. 저장 공간을 확인해 주세요');
      return;
    }
    userProfile = candidate;
    renderProfile();
    closeSheet();
    toast('프로필을 저장했어요');
  };

  window.chooseProfilePhoto = function () {
    const input = document.getElementById('profilePhotoInput');
    input.value = '';
    input.click();
  };

  window.resetProfilePhoto = function () {
    const candidate = Object.assign({}, userProfile, { profileImage: '' });
    if (!persistUserProfile(candidate)) {
      toast('기본 프로필로 변경하지 못했어요. 저장 공간을 확인해 주세요');
      return;
    }
    userProfile = candidate;
    renderProfile();
    toast('기본 프로필로 변경했어요');
  };

  function loadImageFile(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('선택한 이미지 파일을 읽을 수 없습니다.'));
      };
      image.src = url;
    });
  }

  async function compressProfileImage(file) {
    const source = await loadImageFile(file);
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const side = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, (sourceWidth - side) / 2);
    const sourceY = Math.max(0, (sourceHeight - side) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = PROFILE_IMAGE_SIZE;
    canvas.height = PROFILE_IMAGE_SIZE;
    const context = canvas.getContext('2d');
    context.drawImage(source, sourceX, sourceY, side, side, 0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE);
    if (typeof source.close === 'function') source.close();
    return canvas.toDataURL('image/jpeg', 0.78);
  }

  window.handleProfilePhoto = async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('이미지 파일을 선택해 주세요');
      return;
    }
    try {
      const profileImage = await compressProfileImage(file);
      const candidate = Object.assign({}, userProfile, { profileImage });
      if (!persistUserProfile(candidate)) {
        toast('사진 저장 공간이 부족해 기존 사진을 유지해요');
        return;
      }
      userProfile = candidate;
      renderProfile();
      toast('프로필 사진을 변경했어요');
    } catch (error) {
      console.error('[CookCoach profile] 이미지 처리 실패', error);
      toast('사진을 처리하지 못했어요. 다른 이미지를 선택해 주세요');
    }
  };

  function selectedHealthGoals() {
    return userProfile.healthGoals.filter(goalItem => goalItem.selected);
  }

  function renderHealthGoalSummary() {
    const selected = selectedHealthGoals();
    const badge = document.getElementById('goalBadge');
    const text = document.getElementById('goalText');
    const details = document.getElementById('goalDetails');
    if (!badge || !text || !details) return;
    badge.textContent = selected.length
      ? `${selected[0].label}${selected.length > 1 ? ` 외 ${selected.length - 1}개` : ''} 🎯`
      : '건강 목표를 선택해 주세요 🎯';
    text.innerHTML = selected.length
      ? `현재 목표는 <b>${selected.map(item => escapeHtml(item.label)).join(' · ')}</b>이에요.<br>요리 기록을 바탕으로 아래 기준을 참고해요.`
      : '선택한 건강 목표가 없어요.<br>기본 목표를 선택하거나 직접 목표를 추가해 보세요.';
    details.innerHTML = selected.length
      ? selected.map(goalItem => {
          const summary = goalItem.summary || `${goalItem.label}을 꾸준히 실천할 수 있도록 요리 기록을 중심으로 살펴봐요.`;
          const criteria = Array.isArray(goalItem.criteria) && goalItem.criteria.length
            ? goalItem.criteria
            : ['📝 목표와 관련된 한 끼 기록 남기기', '📅 실천한 날짜를 캘린더에서 확인', '🔎 기록의 흐름을 참고용으로 살펴보기'];
          return `<div class="goal-detail-group"><strong>${escapeHtml(goalItem.label)}</strong><p>${escapeHtml(summary)}</p>${criteria.map(item => `<div class="gl">${escapeHtml(item)}</div>`).join('')}</div>`;
        }).join('')
      : '<div class="day-empty">목표를 선택하면 목표별 참고 기준이 표시돼요.</div>';
  }

  window.renderGoal = function () {
    const container = document.getElementById('goalOpts');
    container.innerHTML = userProfile.healthGoals.map(goalItem => `
      <div class="health-goal-option ${goalItem.selected ? 'selected' : ''}">
        <button type="button" class="health-goal-select" onclick="toggleHealthGoal('${escapeHtml(goalItem.id)}')">
          <span class="health-goal-check">${goalItem.selected ? '✓' : '○'}</span>
          <span><strong>${escapeHtml(goalItem.label)}</strong><small>${escapeHtml(goalItem.description)}</small></span>
        </button>
        ${goalItem.custom ? `<button type="button" class="health-goal-delete" onclick="deleteCustomHealthGoal('${escapeHtml(goalItem.id)}')" aria-label="${escapeHtml(goalItem.label)} 삭제">삭제</button>` : ''}
      </div>`).join('');
  };

  window.toggleHealthGoal = function (id) {
    const candidate = Object.assign({}, userProfile, {
      healthGoals: userProfile.healthGoals.map(goalItem => Object.assign({}, goalItem))
    });
    const target = candidate.healthGoals.find(goalItem => goalItem.id === id);
    if (!target) return;
    target.selected = !target.selected;
    if (!persistUserProfile(candidate)) {
      toast('건강 목표를 저장하지 못했어요');
      return;
    }
    userProfile = candidate;
    renderGoal();
    renderHealthGoalSummary();
  };

  window.addCustomHealthGoal = function () {
    const input = document.getElementById('customGoalInput');
    const label = input.value.trim();
    if (!label) {
      toast('추가할 목표를 입력해 주세요');
      input.focus();
      return;
    }
    const normalized = label.toLocaleLowerCase('ko-KR');
    if (userProfile.healthGoals.some(goalItem => goalItem.label.toLocaleLowerCase('ko-KR') === normalized)) {
      toast('이미 등록된 목표예요');
      return;
    }
    userProfile.healthGoals.push({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: label.slice(0, MAX_HEALTH_GOAL_LENGTH),
      description: '직접 추가한 목표',
      summary: `${label.slice(0, MAX_HEALTH_GOAL_LENGTH)}을 꾸준히 실천할 수 있도록 요리 기록을 중심으로 살펴봐요.`,
      criteria: ['📝 목표와 관련된 한 끼 기록 남기기', '📅 실천한 날짜를 캘린더에서 확인', '🔎 기록의 흐름을 참고용으로 살펴보기'],
      custom: true,
      selected: true
    });
    if (!persistUserProfile(userProfile)) {
      userProfile.healthGoals.pop();
      toast('목표를 저장하지 못했어요');
      return;
    }
    input.value = '';
    renderGoal();
    renderHealthGoalSummary();
    toast('직접 목표를 추가했어요');
  };

  window.deleteCustomHealthGoal = function (id) {
    const target = userProfile.healthGoals.find(goalItem => goalItem.id === id);
    if (!target || !target.custom) return;
    const candidate = Object.assign({}, userProfile, {
      healthGoals: userProfile.healthGoals.filter(goalItem => goalItem.id !== id)
    });
    if (!persistUserProfile(candidate)) {
      toast('목표를 삭제하지 못했어요');
      return;
    }
    userProfile = candidate;
    renderGoal();
    renderHealthGoalSummary();
    toast('직접 추가한 목표를 삭제했어요');
  };

  window.saveGoal = function () {
    if (!persistUserProfile(userProfile)) {
      toast('건강 목표를 저장하지 못했어요');
      return;
    }
    renderHealthGoalSummary();
    closeSheet();
    toast('건강 목표를 저장했어요');
  };

  function stepTitle(step) {
    return step && (step.title || step.t) || '';
  }

  function stepHelpItems(step) {
    if (!step) return [];
    if (Array.isArray(step.helps)) return step.helps.filter(item => item && item.question && item.answer);
    return step.help ? [step.help] : [];
  }

  window.handleCustomHelpQuestion = async function ({ question }) {
    return {
      question,
      message: CUSTOM_HELP_ACKNOWLEDGEMENT
    };
  };

  window.submitCustomHelpQuestion = async function () {
    const input = document.getElementById('customHelpQuestion');
    const responseBox = document.getElementById('customHelpResponse');
    const question = input.value.trim();
    if (!question) {
      input.focus();
      return;
    }
    const response = await window.handleCustomHelpQuestion({ question, recipeId: cur.id, stepIndex: stepIdx });
    responseBox.hidden = false;
    responseBox.innerHTML = `
      <div class="custom-help-question"><strong>내 질문</strong><span>${escapeHtml(response.question)}</span></div>
      <div class="custom-help-demo"><p>${escapeHtml(response.message).replace(/\n/g, '<br>')}</p></div>`;
  };

  window.renderHelp = function () {
    const step = cur.steps[stepIdx];
    const helpItems = stepHelpItems(step);
    const currentHelp = helpItems.length
      ? `<div class="current-help-label">현재 STEP ${stepIdx + 1}에서 자주 생기는 문제</div>
         ${helpItems.map(help => `<div class="qa current-help-card open"><div class="qq">🙋 ${escapeHtml(help.question)}</div><div class="aa" style="display:block">→ ${escapeHtml(help.answer)}</div></div>`).join('')}`
      : `<div class="current-help-label">현재 STEP ${stepIdx + 1} 도움말</div><div class="day-empty">현재 단계에 등록된 원문 도움말이 없어요.</div>`;
    document.getElementById('helpBody').innerHTML = `${currentHelp}
      <div class="custom-help-section">
        <h4>다른 문제가 있나요?</h4>
        <p>현재 상황을 직접 알려주세요.</p>
        <textarea id="customHelpQuestion" maxlength="300" rows="4" placeholder="예: 양파가 너무 타고 있는 것 같아요"></textarea>
        <button class="btn ghost sm" type="button" onclick="submitCustomHelpQuestion()">도움 요청하기</button>
        <div class="custom-help-response" id="customHelpResponse" hidden></div>
      </div>`;
  };

  function releaseCameraStream() {
    if (camStream) camStream.getTracks().forEach(track => track.stop());
    const video = document.getElementById('camFeed');
    if (video) {
      try { video.pause(); } catch (error) {}
      video.srcObject = null;
      video.style.display = 'none';
    }
    camStream = null;
    camActive = false;
  }

  window.stopCamera = releaseCameraStream;

  function detectCameraPlatform() {
    const userAgent = navigator.userAgent || '';
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    const coarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const narrowViewport = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 1024;
    const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    return {
      isLikelyMobile: mobileUserAgent || (coarsePointer && touchPoints > 0 && narrowViewport),
      mobileUserAgent,
      coarsePointer,
      touchPoints,
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      userAgent
    };
  }

  async function inspectCameraEnvironment(stage) {
    const mediaDevicesSupported = Boolean(navigator.mediaDevices);
    const getUserMediaSupported = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
    const enumerateDevicesSupported = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function');
    let devices = [];
    let enumerateError = null;
    if (enumerateDevicesSupported) {
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (error) {
        enumerateError = error;
      }
    }
    const videoInputs = devices.filter(device => device.kind === 'videoinput');
    const diagnostics = {
      stage,
      protocol: location.protocol,
      hostname: location.hostname,
      isSecureContext: window.isSecureContext,
      mediaDevicesSupported,
      getUserMediaSupported,
      enumerateDevicesSupported,
      enumerateErrorName: enumerateError && enumerateError.name,
      enumerateErrorMessage: enumerateError && enumerateError.message,
      deviceCount: devices.length,
      videoInputCount: videoInputs.length,
      platform: detectCameraPlatform()
    };
    lastCameraDiagnostics = diagnostics;
    console.groupCollapsed(`[CookCoach camera] 실행 환경 진단 · ${stage}`);
    console.info('protocol', diagnostics.protocol);
    console.info('hostname', diagnostics.hostname);
    console.info('window.isSecureContext', diagnostics.isSecureContext);
    console.info('navigator.mediaDevices 존재 여부', diagnostics.mediaDevicesSupported);
    console.info('getUserMedia 존재 여부', diagnostics.getUserMediaSupported);
    console.info('enumerateDevices 결과', devices);
    console.info('videoInput 개수', diagnostics.videoInputCount);
    if (videoInputs.length) {
      console.table(videoInputs.map((device, index) => ({
        index,
        kind: device.kind,
        label: device.label || '(권한 허용 전에는 이름이 표시되지 않을 수 있음)'
      })));
    }
    if (enumerateError) console.warn('enumerateDevices 실패', enumerateError.name, enumerateError.message, enumerateError);
    console.info('플랫폼 판정', diagnostics.platform);
    console.groupEnd();
    return diagnostics;
  }

  function cameraErrorDetails(error, diagnostics) {
    const name = error && error.name ? error.name : 'UnknownError';
    if (location.protocol === 'file:') {
      return {
        title: '로컬 파일에서는 카메라를 열 수 없어요',
        message: 'localhost 또는 HTTPS 주소에서 다시 실행해 주세요.'
      };
    }
    if (!window.isSecureContext) {
      return {
        title: '안전한 연결이 필요해요',
        message: '카메라는 HTTPS 또는 localhost 환경에서 사용할 수 있어요.'
      };
    }
    const videoInputCount = diagnostics && diagnostics.videoInputCount;
    const enumerationSucceeded = diagnostics && diagnostics.enumerateDevicesSupported && !diagnostics.enumerateErrorName;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        title: '카메라 권한이 꺼져 있어요',
        message: '브라우저의 사이트 설정과 Mac 또는 기기의 카메라 접근 권한을 확인해 주세요.'
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        title: '카메라를 지금 사용할 수 없어요',
        message: '카메라가 다른 앱에서 사용 중이거나 현재 사용할 수 없어요.'
      };
    }
    if (enumerationSucceeded && videoInputCount === 0) {
      return {
        title: '사용 가능한 카메라를 찾을 수 없어요',
        message: '카메라가 연결되어 있는지 확인하거나 사진을 선택해 주세요.'
      };
    }
    if ((name === 'NotFoundError' || name === 'DevicesNotFoundError') && videoInputCount > 0) {
      return {
        title: '카메라를 시작하지 못했어요',
        message: '카메라는 감지됐지만 시작하지 못했어요. 권한을 확인하거나 다시 시도해 주세요.'
      };
    }
    const messages = {
      NotFoundError: ['사용 가능한 카메라를 찾을 수 없어요', '카메라가 연결되어 있는지 확인하거나 사진을 선택해 주세요.'],
      DevicesNotFoundError: ['사용 가능한 카메라를 찾을 수 없어요', '카메라가 연결되어 있는지 확인하거나 사진을 선택해 주세요.'],
      OverconstrainedError: ['요청한 카메라 설정을 사용할 수 없어요', '다시 시도하거나 사진을 선택해 주세요.'],
      SecurityError: ['카메라 접근이 보안 설정으로 차단됐어요', 'HTTPS 또는 localhost 환경과 브라우저 권한을 확인해 주세요.'],
      AbortError: ['카메라 연결이 중단됐어요', '잠시 후 다시 시도해 주세요.'],
      NotSupportedError: ['현재 실행 환경에서는 카메라 기능을 사용할 수 없어요', 'localhost 또는 HTTPS에서 지원 브라우저로 실행해 주세요.']
    };
    const copy = messages[name] || ['카메라를 열지 못했어요', '다시 시도하거나 사진을 선택해 주세요.'];
    return { title: copy[0], message: copy[1] };
  }

  function hideCameraFallback() {
    const fallback = document.getElementById('cameraFallback');
    const backdrop = document.getElementById('cameraSheetBackdrop');
    if (fallback && window.CookCoachBottomSheets && window.CookCoachBottomSheets.close(fallback, { immediate: true })) return;
    if (fallback) fallback.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }

  function showCameraFallback(error, diagnostics) {
    const fallback = document.getElementById('cameraFallback');
    const details = cameraErrorDetails(error, diagnostics);
    document.getElementById('cameraErrorTitle').textContent = details.title;
    document.getElementById('cameraErrorMessage').textContent = details.message;
    if (window.CookCoachBottomSheets) window.CookCoachBottomSheets.open(fallback);
    else fallback.hidden = false;
    const shutter = document.getElementById('shutterBtn');
    shutter.style.visibility = 'visible';
    shutter.textContent = scanMode === 'receipt' ? '영수증 촬영하기' : '냉장고 촬영하기';
  }

  window.closeCameraFallback = function () {
    const fallback = document.getElementById('cameraFallback');
    if (fallback && window.CookCoachBottomSheets && window.CookCoachBottomSheets.close(fallback)) return;
    hideCameraFallback();
  };

  function shouldTryGenericCamera(error) {
    const terminalErrors = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError', 'NotSupportedError'];
    return !terminalErrors.includes(error && error.name);
  }

  function cameraAttempts(diagnostics) {
    const generic = { label: '기본', mode: 'desktop-default', constraints: { video: true, audio: false } };
    if (!diagnostics.platform.isLikelyMobile) return [generic];
    return [
      {
        label: '후면 우선',
        mode: 'mobile-rear-preferred',
        constraints: { video: { facingMode: { ideal: 'environment' } }, audio: false }
      },
      { label: '모바일 기본', mode: 'mobile-generic-fallback', constraints: { video: true, audio: false } }
    ];
  }

  async function getCameraStream(constraints, attempt, attemptIndex) {
    console.info(`[CookCoach camera] getUserMedia attempt ${attemptIndex}`, { attempt, constraints });
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.info(`[CookCoach camera] getUserMedia attempt ${attemptIndex} 성공`, { attempt, constraints });
      return stream;
    } catch (error) {
      console.warn(`[CookCoach camera] getUserMedia attempt ${attemptIndex} 실패`, {
        attempt,
        name: error && error.name,
        message: error && error.message,
        constraints
      }, error);
      throw error;
    }
  }

  async function requestCamera() {
    if (camActive && camStream && camStream.getVideoTracks().some(track => track.readyState === 'live')) return true;
    if (cameraRequest) return cameraRequest;
    cameraRequest = (async () => {
      let diagnostics = await inspectCameraEnvironment('요청 전');
      try {
        if (!window.isSecureContext) {
          const securityError = new Error('getUserMedia requires HTTPS or localhost.');
          securityError.name = 'SecurityError';
          throw securityError;
        }
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          const supportError = new Error('navigator.mediaDevices.getUserMedia is unavailable.');
          supportError.name = 'NotSupportedError';
          throw supportError;
        }
        releaseCameraStream();
        const attempts = cameraAttempts(diagnostics);
        console.info('[CookCoach camera] 요청 전략', {
          isLikelyMobile: diagnostics.platform.isLikelyMobile,
          attempts: attempts.map(attempt => ({ label: attempt.label, constraints: attempt.constraints }))
        });
        let stream = null;
        let finalError = null;
        for (let index = 0; index < attempts.length; index += 1) {
          const attempt = attempts[index];
          try {
            stream = await getCameraStream(attempt.constraints, attempt.label, index + 1);
            lastCameraMode = attempt.mode;
            break;
          } catch (error) {
            finalError = error;
            if (!shouldTryGenericCamera(error)) break;
          }
        }
        if (!stream) throw finalError || new Error('No camera stream was returned.');
        const video = document.getElementById('camFeed');
        camStream = stream;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        if (video.readyState < 1) {
          await new Promise(resolve => {
            const timeout = setTimeout(resolve, 2000);
            video.addEventListener('loadedmetadata', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
        }
        try { await video.play(); } catch (playError) {
          console.warn('[CookCoach camera] 미리보기 자동 재생 실패', playError);
        }
        camActive = true;
        camDenied = false;
        hideCameraFallback();
        showCamLive();
        if (typeof loadModel === 'function') loadModel();
        return true;
      } catch (error) {
        releaseCameraStream();
        lastCameraMode = '';
        camDenied = error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
        diagnostics = await inspectCameraEnvironment('요청 실패 후');
        console.error('[CookCoach camera] getUserMedia 실패', {
          name: error && error.name,
          message: error && error.message,
          protocol: diagnostics.protocol,
          hostname: diagnostics.hostname,
          secureContext: diagnostics.isSecureContext,
          mediaDevices: diagnostics.mediaDevicesSupported,
          getUserMedia: diagnostics.getUserMediaSupported,
          videoInputCount: diagnostics.videoInputCount,
          platform: diagnostics.platform
        }, error);
        showCamOff();
        showCameraFallback(error, diagnostics);
        return false;
      } finally {
        cameraRequest = null;
      }
    })();
    return cameraRequest;
  }

  window.ensureCamera = async function () {
    return requestCamera();
  };

  window.openScanCamera = async function () {
    hideCameraFallback();
    const opened = await requestCamera();
    if (!opened) return false;
    const shutter = document.getElementById('shutterBtn');
    shutter.textContent = '촬영';
    shutter.style.visibility = 'visible';
    toast('카메라가 켜졌어요. 화면을 맞춘 뒤 촬영을 눌러주세요');
    return true;
  };

  window.capture = async function () {
    if (!camActive) {
      await openScanCamera();
      return;
    }
    hideCameraFallback();
    phase2Capture();
  };

  window.skipCurrentScan = function () {
    hideCameraFallback();
    releaseCameraStream();
    phase2SkipCurrentScan();
  };

  window.restartScanFlow = function () {
    hideCameraFallback();
    releaseCameraStream();
    phase2RestartScanFlow();
  };

  window.reshoot = window.restartScanFlow;

  window.chooseScanPhoto = function () {
    const input = document.getElementById('scanFileInput');
    hideCameraFallback();
    input.value = '';
    input.click();
  };

  async function analyzeSelectedScanImage(image) {
    const stage = document.getElementById('scanStage');
    const progress = document.getElementById('analyzBar');
    stage.classList.add('scanning');
    document.getElementById('analyz').classList.add('on');
    document.getElementById('analyzTxt').textContent = '선택한 사진에서 재료를 확인하는 중…';
    progress.style.width = '45%';
    let result = null;
    try {
      if (typeof aiDetect === 'function') {
        result = await Promise.race([
          aiDetect(image),
          new Promise(resolve => setTimeout(() => resolve(null), 8000))
        ]);
      }
    } catch (error) {
      console.warn('[CookCoach camera] 선택한 사진 인식 실패, 데모 결과로 보완합니다.', error);
    }
    progress.style.width = '100%';
    camActive = true;
    setTimeout(() => showDetected(result), 250);
  }

  window.handleScanFile = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('사진 파일을 선택해 주세요');
      return;
    }
    releaseCameraStream();
    hideCameraFallback();
    const reader = new FileReader();
    reader.onerror = error => {
      console.error('[CookCoach camera] 사진 파일 읽기 실패', error);
      toast('사진을 읽지 못했어요. 다시 선택해 주세요');
    };
    reader.onload = () => {
      const image = document.getElementById('scanImg');
      image.onload = () => analyzeSelectedScanImage(image);
      image.onerror = error => {
        console.error('[CookCoach camera] 선택한 사진 미리보기 실패', error);
        toast('사진을 표시하지 못했어요');
      };
      image.src = reader.result;
      image.style.display = 'block';
      document.getElementById('camToggle').style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  function initializePhase3() {
    renderProfile();
    renderHealthGoalSummary();
    renderGoal();
    hideCameraFallback();
    document.getElementById('shutterBtn').onclick = window.capture;
    document.getElementById('scanSkipBtn').onclick = window.skipCurrentScan;
  }

  window.CookCoachPhase3 = {
    getUserProfile: () => JSON.parse(JSON.stringify(userProfile)),
    getCameraEnvironment: () => ({
      secureContext: window.isSecureContext,
      protocol: location.protocol,
      hostname: location.hostname,
      mediaDevices: Boolean(navigator.mediaDevices),
      getUserMedia: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      lastCameraMode,
      platform: detectCameraPlatform(),
      lastDiagnostics: lastCameraDiagnostics ? JSON.parse(JSON.stringify(lastCameraDiagnostics)) : null
    }),
    diagnoseCamera: () => inspectCameraEnvironment('수동 진단'),
    compressProfileImage,
    handleCustomHelpQuestion: window.handleCustomHelpQuestion
  };

  initializePhase3();
})();
