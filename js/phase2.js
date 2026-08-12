(function () {
  'use strict';

  const STORAGE_KEYS = {
    pantry: 'cookcoach.pantry.v2',
    meals: 'cookcoach.meals.v2',
    demoMealsSeeded: 'cookcoach.meals.demo-seeded.v1',
    reminders: 'cookcoach.reminders.v1'
  };

  const DEFAULT_REMINDER_SETTINGS = Object.freeze({
    cookTime: '18:00',
    weeklyDay: 'sun',
    weeklyTime: '21:00',
    fridgeDays: 7
  });
  const REMINDER_DAYS = [
    ['mon', '월요일'],
    ['tue', '화요일'],
    ['wed', '수요일'],
    ['thu', '목요일'],
    ['fri', '금요일'],
    ['sat', '토요일'],
    ['sun', '일요일']
  ];

  const legacy = {
    go,
    setMode,
    capture
  };

  const GYUDON_MEDIA_ROOT = 'assets/recipes/duo-simple-gyudon';
  const GYUDON_ID = 'duo-simple-gyudon';
  const RECIPE_MEDIA_FOLDERS = {
    yubu: 'solo-simple-tofu-inari',
    poke: 'solo-balanced-shrimp-poke',
    salmon: 'solo-fancy-salmon-gnocchi',
    gyudon: 'duo-simple-gyudon',
    shabu: 'duo-balanced-beef-shabu-shabu',
    garlicshrimp: 'duo-fancy-garlic-butter-shrimp-lemon-pasta',
    gambas: 'guest-simple-gambas',
    dubu: 'guest-balanced-tofu-vegetable',
    pork: 'guest-fancy-pork-roll'
  };
  const KNOWN_UNITS = ['g', 'kg', 'ml', 'L', '개', '장', '봉', '팩', '모', 'T', 't', '공기'];

  let scanSession = createScanSession();
  let mealHistory = readStoredArray(STORAGE_KEYS.meals);
  let reminderSettings = loadReminderSettings();
  let unitEdit = null;

  function createScanSession() {
    return {
      phase: 'fridge',
      fridge: { status: 'pending', results: [] },
      receipt: { status: 'pending', results: [] }
    };
  }

  function readStoredArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeStoredArray(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // File previews or privacy modes can deny storage. The in-memory app still works.
    }
  }

  function validReminderTime(value, fallback) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour <= 23 && minute <= 59 ? `${match[1]}:${match[2]}` : fallback;
  }

  function reminderTimeParts(value) {
    const time = validReminderTime(value, '00:00');
    const [hourText, minute] = time.split(':');
    const hour24 = Number(hourText);
    return {
      period: hour24 >= 12 ? 'pm' : 'am',
      time12: `${String(hour24 % 12 || 12).padStart(2, '0')}:${minute}`
    };
  }

  function reminderTimeTo24(period, time12) {
    const match = /^(0[1-9]|1[0-2]):([0-5]\d)$/.exec(String(time12 || ''));
    if (!match || (period !== 'am' && period !== 'pm')) return '';
    let hour = Number(match[1]) % 12;
    if (period === 'pm') hour += 12;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  }

  function reminderTimeOptions(selectedTime) {
    const selectedMinute = Number(String(selectedTime).split(':')[1]);
    const minutes = [0, 10, 20, 30, 40, 50];
    if (Number.isInteger(selectedMinute) && !minutes.includes(selectedMinute)) minutes.push(selectedMinute);
    minutes.sort((left, right) => left - right);
    const values = [];
    for (let hour = 1; hour <= 12; hour += 1) {
      minutes.forEach(minute => values.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`));
    }
    return values.map(value => `<option value="${value}"${value === selectedTime ? ' selected' : ''}>${value}</option>`).join('');
  }

  function loadReminderSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.reminders) || 'null');
      if (!stored || typeof stored !== 'object') return Object.assign({}, DEFAULT_REMINDER_SETTINGS);
      const allowedDays = new Set(REMINDER_DAYS.map(day => day[0]));
      return {
        cookTime: validReminderTime(stored.cookTime, DEFAULT_REMINDER_SETTINGS.cookTime),
        weeklyDay: allowedDays.has(stored.weeklyDay) ? stored.weeklyDay : DEFAULT_REMINDER_SETTINGS.weeklyDay,
        weeklyTime: validReminderTime(stored.weeklyTime, DEFAULT_REMINDER_SETTINGS.weeklyTime),
        fridgeDays: Math.min(30, Math.max(1, Math.round(Number(stored.fridgeDays) || DEFAULT_REMINDER_SETTINGS.fridgeDays)))
      };
    } catch (error) {
      return Object.assign({}, DEFAULT_REMINDER_SETTINGS);
    }
  }

  function persistReminderSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(reminderSettings));
      return true;
    } catch (error) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatQuantity(value) {
    return Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value));
  }

  function ingredientEmoji(id) {
    return EMO[id] || '🥄';
  }

  function ingredientName(id, fallback) {
    return fallback || NAME[id] || id;
  }

  function addIngredientVocabulary() {
    Object.assign(NAME, {
      tsuyu: '쯔유',
      mirin: '미림',
      sugar: '설탕',
      water: '물',
      salt: '소금',
      pepper: '후추',
      wasabi: '와사비'
    });
    Object.assign(EMO, {
      sugar: '🧂',
      water: '💧',
      salt: '🧂',
      pepper: '🧂',
      wasabi: '🌿'
    });
  }

  function syncGyudonRecipe() {
    const recipe = R('gyudon');
    if (!recipe) return;

    recipe.storageId = GYUDON_ID;
    recipe.heroPath = `${GYUDON_MEDIA_ROOT}/hero.png`;
    recipe.desc = '쯔유 소스에 소고기와 양파를 졸이고 계란을 더해 밥 위에 올리는 2인분 규동이에요.';
    recipe.ing = [
      { id: 'beef', n: '소고기', e: ingredientEmoji('beef'), amount: 200, unit: 'g', required: true },
      { id: 'onion', n: '양파', e: ingredientEmoji('onion'), amount: 0.5, unit: '개', required: true },
      { id: 'egg', n: '계란', e: ingredientEmoji('egg'), amount: 1, unit: '개', required: true },
      { id: 'rice', n: '밥', e: ingredientEmoji('rice'), amount: 400, unit: 'g', required: true },
      { id: 'tsuyu', n: '쯔유', e: ingredientEmoji('tsuyu'), amount: 6, unit: 'T', required: true },
      { id: 'mirin', n: '미림', e: ingredientEmoji('mirin'), amount: 2, unit: 'T', required: true },
      { id: 'sugar', n: '설탕', e: ingredientEmoji('sugar'), amount: 1.5, unit: 'T', required: true },
      { id: 'water', n: '물', e: ingredientEmoji('water'), amount: 120, unit: 'ml', required: true },
      { id: 'salt', n: '소금', e: ingredientEmoji('salt'), amount: 1, unit: '약간', required: true },
      { id: 'pepper', n: '후추', e: ingredientEmoji('pepper'), amount: 1, unit: '약간', required: true }
    ];
    recipe.steps = [
      {
        step: 1,
        title: '재료손질',
        duration: 3,
        description: '준비한 소고기 200g에 소금과 후추로 조금만 뿌려 밑간을 해주세요.\n양파 반개를 0.5센치 두깨로 얇게 썰어주세요.\n계란 1개를 작은 그릇에 풀어주세요.',
        image: `${GYUDON_MEDIA_ROOT}/step-01.png`,
        help: {
          question: '양파를 너무 두껍게 썰었어요!',
          answer: '걱정하지말아요! 익히는 과정에서 고기를 좀 덜 익힌 다음에 양파를 넣으면 됩니다. 만약, 양파가 얇다면 반대로 하면 돼요!!'
        }
      },
      {
        step: 2,
        title: '소스만들기',
        duration: 1,
        description: '쯔유6T, 미림2T, 설탕 1.5T, 물 120ml을 그릇에 설탕이 녹을 때까지 섞어주세요.',
        image: `${GYUDON_MEDIA_ROOT}/step-02.png`,
        help: {
          question: '설탕이 잘 녹지 않아요.',
          answer: '그럴땐, 숟가락으로 바닥을 긁듯이 하면, 잘 녹아요! 계속 젓다보면 녹아요! 노력은 배신하지 않는답니다~!'
        }
      },
      {
        step: 3,
        title: '고기 및 양파 익히기',
        duration: 5,
        description: '팬을 중불로 달군 뒤 중약불로 줄여 고기를 40%만 구워주세요.\n그 후에, 양파를 같이 넣고, 양파가 투명해질때까지 구워주세요.',
        image: `${GYUDON_MEDIA_ROOT}/step-03.png`,
        help: {
          question: '고기를 40%만 익힌 상태가 뭔지 모르겠어요.',
          answer: '저 수치는 절대적인 수치가 아니에요! 고기 겉면은 갈색으로 변했지만, 안쪽에 붉은 부분이 조금 남아있는 상태입니다.'
        }
      },
      {
        step: 4,
        title: '소스를 넣고 졸이기',
        duration: 4,
        description: '고기와 양파를 익힌 팬을 그대로 두고, 아까 만들었던 소스를 원을 그리며 넣어주세요.\n불은 약불로 줄이고 소스가 팬에 자작해질때까지 졸여주세요.\n이때 양파와 고기를 골고루 뒤집어가면서 졸여주면 더 맛있어요!',
        image: `${GYUDON_MEDIA_ROOT}/step-04.png`,
        help: {
          question: '소스가 자작한 상태인지 모르겠어요.',
          answer: '팬을 기울였을 때, 소스가 바닥에 얇게 남아 흐르는 정도면 충분해요. 국물이 아닌 조림을 떠오르면 쉬울거에요!'
        }
      },
      {
        step: 5,
        title: '具材(구자이) 만들기',
        duration: 1,
        description: '적당히 졸여진 팬에 아까 풀어놨던 계란을 원을 그리며 넣어주세요.\n그리고 뚜껑을 덮고, 10초 뒤 불을 끄고 30초동안 뜸을 들여주세요.',
        image: `${GYUDON_MEDIA_ROOT}/step-05.png`,
        help: {
          question: '계란이 너무 익어버렸어요.',
          answer: '바로 불을 끄고, 뚜껑을 열어주세요. 팬의 잔열로 계속 익기 때문에 가열하지 않은 화구로 팬을 이동시키면 됩니다!'
        }
      },
      {
        step: 6,
        title: '완성',
        duration: 1,
        description: '큰 그릇에 밥 400g을 담고 만들었던 구자위를 예쁘게 담아주세요.\n이때 기호에 맞게 와사비나 계란 노른자를 올려드시면 더욱 맛있습니다.',
        image: `${GYUDON_MEDIA_ROOT}/step-06.png`,
        help: {
          question: '밥 위에 재료를 어떻게 올려야 예쁘게 보이나요?',
          answer: '자작한 소스를 밥위에 먼저 골고루 뿌리고, 그 위에 계란으로 인해 덩어리진 구자이를 넓적한 뒤집개를 이용해 올려주세요!'
        }
      }
    ];
  }

  function syncRecipeMedia() {
    RECIPES.forEach(recipe => {
      const folder = RECIPE_MEDIA_FOLDERS[recipe.id];
      if (!folder) return;
      const mediaRoot = `assets/recipes/${folder}`;
      recipe.storageId = folder;
      recipe.heroPath = `${mediaRoot}/hero.png`;
      recipe.steps.forEach((step, index) => {
        step.image = `${mediaRoot}/step-${String(index + 1).padStart(2, '0')}.png`;
      });
    });
  }

  function syncRecipeStepHelp() {
    const helpByRecipe = {
      yubu: {
        1: [['두부 물기가 잘 빠지지 않아요!', '괜찮아요! 두부에 수분이 많이 남아 있으면 나중에 속이 질어질 수 있어요. 키친타월을 새것으로 바꾼 뒤 두부가 으깨지지 않을 정도로 한 번 더 꾹 눌러 물기를 제거해주세요.']],
        2: [['달걀이 너무 퍽퍽하게 익었어요!', '걱정하지 마세요! 조금 단단하게 익어도 잘게 으깨 두부와 섞으면 사용할 수 있어요. 다음에는 달걀이 완전히 굳기 전에 불을 끄고 팬의 잔열로 마무리하면 더 부드럽게 만들 수 있어요.']],
        3: [['두부 속이 너무 질어서 유부에서 흘러나올 것 같아요!', '두부에 수분이 많이 남아 있을 가능성이 커요. 키친타월로 두부의 물기를 한 번 더 제거한 뒤 다시 섞어주세요. 속이 너무 묽으면 유부에 넣었을 때 흘러나올 수 있어요.']],
        4: [['유부가 자꾸 찢어져요!', '속을 너무 많이 넣지 않았는지 확인해주세요! 유부를 억지로 벌리지 말고 숟가락으로 조금씩 채워주세요. 유부의 약 80% 정도만 채우면 훨씬 쉽게 모양을 잡을 수 있어요.']],
        5: [['두부 속이 너무 밍밍해요!', '유부 자체에도 간이 있으니 먼저 유부와 함께 한입 맛을 봐주세요. 그래도 부족하다면 소금이나 간장을 아주 조금씩 추가해서 간을 맞춰주세요.']]
      },
      poke: {
        1: [['달걀이 너무 단단하게 익었어요!', '괜찮아요! 포케볼에서는 잘라서 다른 재료와 함께 먹기 때문에 그대로 사용해도 괜찮아요. 다음에는 원하는 익힘보다 조금 일찍 꺼낸 뒤 찬물에 식혀주면 추가로 익는 것을 줄일 수 있어요.']],
        2: [['아보카도를 잘랐는데 너무 딱딱해요!', '억지로 사용하지 않아도 괜찮아요! 달걀의 양을 조금 늘리거나 두부나 옥수수처럼 가지고 있는 다른 재료로 채워도 좋아요.']],
        3: [['새우에서 물이 계속 나와요!', '새우 표면에 물기가 충분히 제거되지 않았을 수 있어요. 이미 굽고 있다면 팬에 고인 물을 조심해서 제거한 뒤 짧게 익혀주세요. 다음 새우는 키친타월로 물기를 충분히 닦아주면 더 노릇하게 구울 수 있어요.']],
        4: [['소스가 너무 짜요!', '괜찮아요! 레몬즙이나 물을 조금씩 추가하면서 맛을 조절해주세요. 포케볼에 넣을 때도 처음부터 전부 붓지 말고 조금씩 넣으면서 간을 확인하는 게 좋아요.']],
        5: [['재료를 어떻게 담아야 예쁘게 보이나요?', '현미밥을 먼저 담고 색이 다른 재료가 서로 겹치지 않도록 새우, 달걀, 아보카도, 오이, 토마토와 채소를 둘러서 배치해보세요. 각각의 재료가 한눈에 보여 훨씬 깔끔해 보여요!']],
        6: [['소스를 얼마나 뿌려야 할지 모르겠어요!', '처음부터 소스를 전부 붓지 말고 절반 정도만 가볍게 둘러주세요. 한입 먹어본 뒤 부족하면 조금씩 더 추가하면 너무 짜지는 것을 막을 수 있어요.']]
      },
      salmon: {
        1: [['연어에 물기가 계속 남아 있어요!', '연어 표면에 물기가 많으면 팬에서 노릇하게 굽기 어려워요. 키친타월을 연어 위에 올리고 문지르지 말고 가볍게 눌러서 겉면의 물기를 제거해주세요.']],
        2: [['연어가 팬에 붙어서 뒤집어지지 않아요!', '바로 억지로 떼지 마세요! 연어 표면이 충분히 익으면 팬에서 비교적 자연스럽게 떨어져요. 조금 더 기다렸다가 뒤집어주세요. 겉면이 너무 빠르게 갈색으로 변한다면 불도 조금 낮춰주세요.']],
        3: [['뇨끼가 팬에 붙어서 잘 뒤집어지지 않아요!', '바로 계속 움직이지 말고 한쪽 면이 살짝 노릇해질 때까지 기다려주세요. 겉면이 익어 단단해지면 훨씬 쉽게 떨어지고 뒤집을 수 있어요.']],
        4: [['크림소스가 너무 묽어요!', '약불에서 조금 더 졸여주세요. 그래도 묽다면 파르메산 치즈를 조금씩 추가하면서 원하는 농도로 맞춰주세요.']],
        5: [['레몬을 넣었더니 소스가 분리된 것 같아요!', '강한 불에서 레몬즙을 넣으면 크림소스가 분리될 수 있어요. 불을 약하게 줄이거나 끈 뒤 천천히 섞어주세요. 다음에는 불을 줄인 뒤 마지막에 레몬즙을 넣어주세요.']],
        6: [['플레이팅하는 동안 크림소스가 너무 꾸덕해졌어요!', '우유를 한두 숟갈씩 넣고 약한 불에서 천천히 섞어주세요. 한 번에 많이 넣지 말고 원하는 농도가 될 때까지만 조금씩 풀어주면 돼요.']]
      },
      gyudon: {
        1: [['양파를 너무 두껍게 썰었어요!', '걱정하지말아요! 익히는 과정에서 고기를 좀 덜 익힌 다음에 양파를 넣으면 됩니다. 만약, 양파가 얇다면 반대로 하면 돼요!!']],
        2: [['설탕이 잘 녹지 않아요.', '그럴땐, 숟가락으로 바닥을 긁듯이 하면, 잘 녹아요! 계속 젓다보면 녹아요! 노력은 배신하지 않는답니다~!']],
        3: [['고기를 40%만 익힌 상태가 뭔지 모르겠어요.', '저 수치는 절대적인 수치가 아니에요! 고기 겉면은 갈색으로 변했지만, 안쪽에 붉은 부분이 조금 남아있는 상태입니다.']],
        4: [['소스가 자작한 상태인지 모르겠어요.', '팬을 기울였을 때, 소스가 바닥에 얇게 남아 흐르는 정도면 충분해요. 국물이 아닌 조림을 떠오르면 쉬울거에요!']],
        5: [['계란이 너무 익어버렸어요.', '바로 불을 끄고, 뚜껑을 열어주세요. 팬의 잔열로 계속 익기 때문에 가열하지 않은 화구로 팬을 이동시키면 됩니다!']],
        6: [['밥 위에 재료를 어떻게 올려야 예쁘게 보이나요?', '자작한 소스를 밥위에 먼저 골고루 뿌리고, 그 위에 계란으로 인해 덩어리진 구자이를 넓적한 뒤집개를 이용해 올려주세요!']]
      },
      shabu: {
        1: [['채소 크기가 제각각이에요.', '채소 손질과 양은 절대적인 수치가 아닌 사용자의 기호에 맞게 손질하셔도 됩니다!']],
        2: [['소스가 너무 셔요', '그럴땐, 물 1T와 설탕 0.5T를 넣어주세요! 만약 해결이 안된다면, 다시 이 과정을 반복해주세요!']],
        3: [['육수가 너무 짜요', '물을 100ml씩 추가하면서 간을 확인해주세요. 이후 채소에서 물이 나오기 때문에, 처음에는 약간 짭짤한 정도가 적당해요.']],
        4: [['냄비에 채소가 너무 많아 보여요.', '채소는 익으면서 부피가 줄어드니 걱정마세요! 숨이 살짝 죽으면, 국자로 채소를 눌러주면 국물에 푹 잠겨요.']],
        5: [['소고기가 질겨요.', '얇은 소고기는 오래 끓일 수록 질겨져요. 붉은 색이 사라진 뒤 5초 안에 바로 건져주세요.']],
        6: [['우동을 넣었더니 국물이 너무 싱거워졌어요.', '쯔유를 0.5T 단위로 추가하면서, 국물의 간을 맞춰주세요.']]
      },
      garlicshrimp: {
        1: [['새우에서 물이 계속 나와요.', '새우 표면에 물기가 남아 있으면, 구울 때 기름이 튀고 노릇하게 익지 않아요. 물기를 키친타올로 잘 닦아 주되, 새우가 으스러지지않게 겉면만 닦아주세요.']],
        2: [['파스타면이 알맞게 익었는지 모르겠어요.', '면 한 가닥을 먹어봤을 때 겉은 부드럽지만 약간 단단한 식감이 남아있으면 적당히 익은 거에요. 추후에 팬에서 익힐거나 살짝 덜 익혀야 해요.']],
        3: [['새우가 너무 단단하고 질겨졌어요.', '새우는 오래 익히면 O자 모양으로 둥글게 말리면서 질겨져요. 전체가 분홍색으로 변하고 C자 모양이 되면 바로 팬에서 꺼내주세요.']],
        4: [['마늘이 빠르게 갈색으로 변하고 있어요.', '팬을 바로 불에서 안쓰는 화구로 내려주세요. 마늘은 잔열로도 계속 익어요. 마늘이 타면 쓴맛이 날 수 있으니 건져내세요.']],
        5: [['버터소스가 면에 붙지 않고 기름처럼 따로 놀아요.', '면수 1~2T를 추가하고 집게로 면을 빠르게 섞어주세요. 면수의 전분이 버터와 오일을 섞어 부드러운 소스로 만들어줘요.']],
        6: [['새우와 파스타를 근사하게 담기 어려워요.', '면 세팅 -> 소스 붓기 -> 새우 세팅 -> 부가재료 첨가하기 순서로 진행하면 원활하게 될거에요!']]
      },
      gambas: {
        1: [['재료를 어떤 순서로 준비해야 할지 헷갈려요!', '괜찮아요! 먼저 새우와 마늘을 손질하고 페퍼론치노, 올리브유, 파슬리를 바로 사용할 수 있게 옆에 놓아주세요. 감바스는 조리가 빠르게 진행되기 때문에 시작 전에 재료를 모두 준비해두면 훨씬 편해요.']],
        2: [['새우에 물기가 조금 남아 있어도 괜찮나요?', '가능하면 충분히 제거해주세요! 새우 표면에 물기가 남아 있으면 뜨거운 오일에 넣었을 때 기름이 심하게 튈 수 있어요. 키친타월로 문지르기보다 눌러서 물기를 제거해주세요.']],
        3: [['마늘 두께가 제각각이에요!', '너무 걱정하지 않아도 돼요! 다만 아주 얇은 마늘은 먼저 탈 수 있으니 가능하면 비슷한 두께로 맞춰주세요. 두꺼운 조각이 있다면 조금 더 얇게 잘라주면 익는 속도를 맞추기 쉬워요.']],
        4: [['마늘이 너무 빨리 갈색으로 변해요!', '불이 조금 강할 수 있어요! 바로 약불로 낮추거나 팬을 잠시 불에서 내려주세요. 마늘은 잔열에도 계속 익기 때문에 진한 갈색이 되기 전에 천천히 향을 내는 것이 좋아요.']],
        5: [['새우를 넣었더니 기름이 너무 심하게 튀어요!', '즉시 불을 끄고 팬을 뚜껑으로 일부 가려주세요. 기름이 진정되면 남은 새우의 물기를 다시 닦고 약한 불에서 조금씩 넣어 조리해주세요. 뜨거운 기름에는 절대로 물을 넣지 마세요.']],
        6: [['새우가 다 익었는지 모르겠어요!', '새우의 투명한 부분이 사라지고 전체적으로 분홍빛이 돌면 익은 상태에 가까워요. 너무 오래 익히면 질겨질 수 있으니 익었다면 바로 불을 끄고 파슬리를 뿌려 마무리해주세요.']]
      },
      dubu: {
        1: [['두부 물기가 잘 제거되지 않아요!', '두부를 키친타월로 감싸고 위에서 가볍게 눌러주세요. 너무 강하게 누르면 두부가 부서질 수 있으니 모양을 유지하면서 표면의 수분을 충분히 제거하면 돼요.']],
        2: [['채소 크기가 제각각이 됐어요!', '완전히 똑같을 필요는 없어요! 다만 비슷한 크기로 맞추면 익는 시간이 비슷해져요. 특히 두꺼운 당근이나 애호박 조각만 조금 더 얇게 잘라주면 좋아요.']],
        3: [['양념장이 너무 짠 것 같아요!', '물을 조금씩 추가하면서 간을 다시 확인해주세요. 한 번에 많이 넣기보다 한 숟갈씩 넣어가며 조절하면 양념 맛이 너무 옅어지는 것을 막을 수 있어요.']],
        4: [['두부가 팬에 달라붙어서 뒤집을 때 부서져요!', '억지로 바로 떼지 마세요! 1~2분 정도 더 구워 표면에 노릇한 막이 생길 때까지 기다려주세요. 그다음 넓은 뒤집개를 두부 아래까지 넣고 한 번에 뒤집으면 덜 부서져요.']],
        5: [['당근은 아직 단단한데 다른 채소는 너무 익는 것 같아요!', '익는 데 오래 걸리는 양파와 당근을 먼저 충분히 볶아주세요. 그다음 애호박과 버섯을 넣으면 채소마다 익는 정도를 맞추기 쉬워요.']],
        6: [['양념이 너무 빨리 졸아들어요!', '불을 조금 낮추고 물을 한 숟갈씩 추가해주세요. 두부가 부서지지 않도록 세게 젓기보다 팬을 살짝 흔들면서 양념을 골고루 묻혀주세요.']],
        7: [['두부와 채소를 어떻게 담아야 깔끔해 보이나요?', '밥을 먼저 그릇에 담고 두부와 채소가 골고루 보이도록 위에 올려주세요. 마지막으로 팬에 남은 양념을 조금씩 끼얹으면 재료에 윤기가 돌고 더 깔끔하게 완성할 수 있어요.']]
      },
      pork: {
        1: [['돼지고기 크기가 조금씩 달라요!', '괜찮아요! 너무 작은 고기는 두 장을 살짝 겹쳐 사용해도 돼요. 채소를 올리고 말 수 있을 정도의 폭만 확보하면 만드는 데 큰 문제는 없어요.']],
        2: [['채소 길이가 돼지고기보다 너무 길어요!', '돼지고기 폭에 맞춰 약 5cm 정도로 다시 잘라주세요. 채소가 고기 밖으로 너무 많이 튀어나오면 말이가 풀리기 쉬워요.']],
        3: [['밑간을 너무 많이 한 것 같아요!', '소금과 후추가 표면에 너무 많이 보인다면 키친타월로 가볍게 털어내거나 닦아주세요. 이후 간장 양념이 들어가므로 밑간은 가볍게 하는 정도면 충분해요.']],
        4: [['채소가 너무 많아서 고기가 잘 말리지 않아요!', '속재료를 조금 덜어내고 다시 말아주세요. 채소를 많이 넣는 것보다 고기가 한 바퀴 이상 감싸질 정도로 넣는 것이 풀리지 않고 모양을 잡기 쉬워요.']],
        5: [['설탕이 양념장에 잘 녹지 않아요!', '숟가락으로 그릇 바닥을 긁듯이 저어주세요. 설탕 알갱이가 거의 보이지 않을 때까지 충분히 섞으면 조릴 때 맛이 더 고르게 배어요.']],
        6: [['굽는 도중 야채말이가 자꾸 풀려요!', '풀린 말이를 집게로 다시 모아 이음매가 아래로 가도록 놓아주세요. 계속 풀린다면 이쑤시개로 임시 고정해서 구워도 괜찮아요. 단, 플레이팅하기 전에는 반드시 이쑤시개를 제거해주세요.']],
        7: [['양념장이 너무 빨리 졸거나 타는 것 같아요!', '불을 조금 더 낮춰주세요. 양념이 너무 빠르게 줄었다면 물을 아주 조금 추가하고 말이를 굴려가며 골고루 조려주세요.']],
        8: [['썰 때 야채말이가 다시 풀려요!', '불에서 내린 직후 바로 자르지 말고 잠시 식혀 모양이 안정될 때까지 기다려주세요. 그다음 잘 드는 칼로 한 번에 썰어주면 훨씬 깔끔해요. 이쑤시개를 사용했다면 썰기 전에 반드시 제거해주세요.']]
      }
    };

    RECIPES.forEach(recipe => {
      const recipeHelp = helpByRecipe[recipe.id] || {};
      recipe.steps.forEach((step, index) => {
        const helps = (recipeHelp[index + 1] || []).map(item => ({ question: item[0], answer: item[1] }));
        delete step.help;
        delete step.helps;
        if (!helps.length) return;
        step.helps = helps;
        step.help = helps[0];
      });
    });
  }

  function stepTitle(step) {
    return step.title || step.t || '';
  }

  function stepDescription(step) {
    return step.description || step.d || '';
  }

  function stepSeconds(step) {
    return Number.isFinite(step.duration) ? step.duration * 60 : (step.sec || 0);
  }

  function recipeHeroSource(recipe) {
    if (recipe.heroPath) return recipe.heroPath;
    return IMG[recipe.hero] || '';
  }

  function stepImageSource(recipe, step) {
    if (step.image) return step.image;
    return step.ph ? (IMG[step.ph] || '') : '';
  }

  function mediaContent(source, title, subtitle, kicker) {
    const safeSource = escapeHtml(source);
    const safeTitle = escapeHtml(title);
    const safeSubtitle = escapeHtml(subtitle);
    return `${source ? `<img src="${safeSource}" alt="${safeTitle}" onload="handleMediaLoad(this)" onerror="handleMediaError(this)">` : ''}
      <div class="media-placeholder" role="img" aria-label="${safeTitle} ${safeSubtitle}">
        <div class="media-kicker">${escapeHtml(kicker || 'COOKCOACH')}</div>
        <strong>${safeTitle}</strong>
        <span>${safeSubtitle}</span>
      </div>`;
  }

  function mediaFrame(source, title, subtitle, className, kicker) {
    return `<div class="media-frame ${className || ''}">${mediaContent(source, title, subtitle, kicker)}</div>`;
  }

  window.handleMediaLoad = function (image) {
    image.removeAttribute('hidden');
    image.classList.add('is-loaded');
    const placeholder = image.parentElement && image.parentElement.querySelector('.media-placeholder');
    if (placeholder) placeholder.hidden = true;
  };

  window.handleMediaError = function (image) {
    image.classList.remove('is-loaded');
    image.style.display = 'none';
    image.removeAttribute('src');
    const placeholder = image.parentElement && image.parentElement.querySelector('.media-placeholder');
    if (placeholder) placeholder.hidden = false;
  };

  function pantryItem(id, name, quantity, unit, expiry) {
    return { id, n: name, e: ingredientEmoji(id), q: quantity, u: unit, exp: expiry == null ? 7 : expiry };
  }

  function demoPantry() {
    return [
      pantryItem('beef', '소고기', 200, 'g', 2),
      pantryItem('onion', '양파', 0.5, '개', 18),
      pantryItem('egg', '계란', 1, '개', 9),
      pantryItem('rice', '밥', 400, 'g', 7),
      pantryItem('tsuyu', '쯔유', 6, 'T', 30),
      pantryItem('mirin', '미림', 2, 'T', 30),
      pantryItem('sugar', '설탕', 1.5, 'T', 30),
      pantryItem('water', '물', 120, 'ml', 30),
      pantryItem('salt', '소금', 1, '약간', 30),
      pantryItem('pepper', '후추', 1, '약간', 30),
      pantryItem('wasabi', '와사비', 1, '선택', 30)
    ];
  }

  function persistPantry() {
    writeStoredArray(STORAGE_KEYS.pantry, pantry);
  }

  function loadPantry() {
    const stored = readStoredArray(STORAGE_KEYS.pantry);
    if (!stored.length) return;
    pantry = stored
      .filter(item => item && item.id && Number(item.q) > 0)
      .map(item => ({
        id: item.id,
        n: item.n || ingredientName(item.id),
        e: item.e || ingredientEmoji(item.id),
        q: Number(item.q),
        u: item.u || '개',
        exp: Number.isFinite(Number(item.exp)) ? Number(item.exp) : 7
      }));
  }

  window.go = function (id, push) {
    if (push === undefined) push = true;
    const currentView = document.querySelector('.view.on');
    if (currentView && currentView.id === 'v-coach' && id !== 'coach') {
      clearInterval(timerId);
      running = false;
    }
    const dropdown = document.getElementById('dd');
    if (dropdown) dropdown.classList.remove('on');
    if (currentView && push) stack.push(currentView.id.replace('v-', ''));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('on'));
    const nextView = document.getElementById(`v-${id}`);
    if (!nextView) return;
    const screen = document.getElementById('screen');
    if (screen) screen.scrollTop = 0;
    nextView.classList.add('on');
    nextView.querySelectorAll('.scroll').forEach(scroll => { scroll.scrollTop = 0; });
    syncTabs(id);
    if (currentView && currentView.id === 'v-home' && id !== 'home') {
      stopCamera();
      showCamOff();
    }
    if (id === 'report') animateReport();
    if (id === 'mypage') {
      renderCal();
      renderSamsi();
    }
  };

  function removeScanCompleteBadge() {
    const badge = document.querySelector('.scan-complete-badge');
    if (badge) badge.remove();
  }

  function updateScanButtons(primaryLabel, primaryAction, secondaryLabel, secondaryAction, captureMode) {
    const primary = document.getElementById('shutterBtn');
    const secondary = document.getElementById('scanSkipBtn');
    const actions = primary.closest('.phase2-scan-actions');
    primary.style.visibility = 'visible';
    primary.textContent = primaryLabel;
    primary.onclick = primaryAction;
    secondary.textContent = secondaryLabel;
    secondary.onclick = secondaryAction;
    primary.setAttribute('aria-label', primaryLabel);
    secondary.setAttribute('aria-label', captureMode ? `${scanSession.phase === 'fridge' ? '냉장고' : '영수증'} 촬영 건너뛰기` : secondaryLabel);
    if (actions) actions.classList.toggle('capture-layout', Boolean(captureMode));
  }

  function setScanPhase(phase) {
    scanSession.phase = phase;
    removeScanCompleteBadge();
    legacy.setMode(phase);
    const isFridge = phase === 'fridge';
    document.getElementById('scanStep').textContent = `SCAN · ${isFridge ? '1' : '2'}/2`;
    document.getElementById('scanSub').textContent = isFridge
      ? '촬영하거나 건너뛴 뒤 영수증 단계로 이동해요.'
      : '마지막 촬영 단계예요. 촬영하거나 건너뛰어 주세요.';
    document.getElementById('segF').classList.toggle('on', isFridge);
    document.getElementById('segR').classList.toggle('on', !isFridge);
    updateScanButtons(
      isFridge ? '냉장고 촬영하기' : '영수증 촬영하기',
      window.capture,
      '건너뛰기',
      window.skipCurrentScan,
      true
    );
  }

  window.setMode = function (mode) {
    if (mode !== scanSession.phase) {
      toast('촬영은 냉장고 다음 영수증 순서로 진행돼요');
    }
  };

  window.swipeStart = function () {};
  window.swipeEnd = function () {};

  window.startCookCoach = function () {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('hide');
    const screen = document.getElementById('screen');
    if (screen) {
      screen.scrollTop = 0;
      requestAnimationFrame(() => { screen.scrollTop = 0; });
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    scanSession = createScanSession();
    setScanPhase('fridge');
  };

  window.capture = async function () {
    if (!camActive) {
      const opened = await ensureCamera(true);
      if (!opened) toast('카메라를 열 수 없어 데모 촬영 결과로 계속 진행해요');
    }
    legacy.capture();
  };

  function fallbackResults(phase) {
    return phase === 'fridge'
      ? [
          { id: 'broccoli', q: 1, u: '개', c: 98 },
          { id: 'ctomato', q: 1, u: '팩', c: 96 },
          { id: 'carrot', q: 2, u: '개', c: 95 },
          { id: 'egg', q: 4, u: '개', c: 94 },
          { id: 'onion', q: 1, u: '개', c: 91 }
        ]
      : [
          { id: 'onion', q: 2, u: '개', c: 99 },
          { id: 'scallion', q: 1, u: '단', c: 98 },
          { id: 'tofu', q: 1, u: '모', c: 97 },
          { id: 'egg', q: 10, u: '개', c: 97 },
          { id: 'mushroom', q: 1, u: '팩', c: 95 },
          { id: 'shrimp', q: 1, u: '팩', c: 92 }
        ];
  }

  function mergeScanResults() {
    const merged = new Map();
    ['fridge', 'receipt'].forEach(source => {
      scanSession[source].results.forEach(item => {
        const previous = merged.get(item.id);
        if (!previous) {
          merged.set(item.id, Object.assign({}, item));
        } else {
          previous.q = Math.max(Number(previous.q), Number(item.q));
          previous.c = Math.max(Number(previous.c || 0), Number(item.c || 0));
        }
      });
    });
    return Array.from(merged.values());
  }

  function showScanComplete(phase, usedCamera, usedAI) {
    const stage = document.getElementById('scanStage');
    stage.classList.remove('scanning');
    document.getElementById('analyz').classList.remove('on');
    document.getElementById('analyzBar').style.width = '0';
    stopCamera();
    showCamOff();
    removeScanCompleteBadge();
    const badge = document.createElement('div');
    badge.className = 'scan-complete-badge';
    badge.innerHTML = `<strong>${phase === 'fridge' ? '냉장고' : '영수증'} 촬영 완료</strong>
      <span>${usedAI ? '인식된 재료를 저장했어요.' : usedCamera ? '사진에서 확인하기 어려운 항목은 데모 결과로 보완했어요.' : '카메라를 사용할 수 없어 데모 결과를 저장했어요.'}</span>`;
    stage.appendChild(badge);
    if (phase === 'fridge') {
      updateScanButtons('다음 · 영수증', () => setScanPhase('receipt'), '다시 촬영하기', () => retakeScan('fridge'), false);
    } else {
      updateScanButtons('재료 확인', finishScanFlow, '다시 촬영하기', () => retakeScan('receipt'), false);
    }
  }

  function retakeScan(phase) {
    scanSession[phase] = { status: 'pending', results: [] };
    setScanPhase(phase);
  }

  window.showDetected = function (ai) {
    const phase = scanSession.phase;
    const usedCamera = camActive;
    const usedAI = Boolean(ai && ai.length);
    const results = usedAI
      ? ai.map(item => ({ id: item.id, q: item.q, u: UNIT[item.id] || '개', c: item.c }))
      : fallbackResults(phase);
    scanSession[phase] = { status: 'captured', results };
    aiUsed = usedAI;
    showScanComplete(phase, usedCamera, usedAI);
  };

  window.skipCurrentScan = function () {
    const phase = scanSession.phase;
    scanSession[phase] = { status: 'skipped', results: [] };
    stopCamera();
    showCamOff();
    if (phase === 'fridge') setScanPhase('receipt');
    else finishScanFlow();
  };

  function finishScanFlow() {
    const bothSkipped = scanSession.fridge.status === 'skipped' && scanSession.receipt.status === 'skipped';
    if (bothSkipped) {
      stopCamera();
      openSheet('sheet-demo');
      return;
    }
    detected = mergeScanResults();
    renderDetected();
    const source = [
      scanSession.fridge.status === 'captured' ? '냉장고' : '',
      scanSession.receipt.status === 'captured' ? '영수증' : ''
    ].filter(Boolean).join(' + ');
    document.getElementById('detSource').textContent = `${source} 촬영 결과를 합쳤어요. 인식 결과를 확인하고 필요한 재료를 직접 추가할 수 있어요.`;
    legacy.go('confirm', false);
    setTimeout(() => { document.getElementById('confBar').style.width = '100%'; }, 80);
  }

  window.restartScanFlow = function () {
    closeSheet();
    scanSession = createScanSession();
    stopCamera();
    go('home', false);
    setScanPhase('fridge');
  };

  window.reshoot = window.restartScanFlow;

  window.useDemoPantry = function () {
    pantry = demoPantry();
    sel = { who: 'two', concept: 'simple' };
    filter = 'simple';
    persistPantry();
    closeSheet();
    renderPantry();
    renderCook();
    renderMenuList();
    tab('pantry');
    toast('소고기를 포함한 규동 데모 재료를 준비했어요');
  };

  window.acceptDetected = function () {
    detected.filter(item => Number(item.q) > 0).forEach(item => {
      const existing = pantry.find(pantryItemValue => pantryItemValue.id === item.id);
      if (existing) {
        existing.q = Math.max(Number(existing.q), Number(item.q));
        existing.u = item.u || existing.u;
      } else {
        pantry.push(pantryItem(item.id, ingredientName(item.id), Number(item.q), item.u || '개', 7));
      }
    });
    persistPantry();
    renderPantry();
    renderCook();
    tab('cook');
    toast('촬영 재료를 확인하고 메뉴 추천에 반영했어요');
  };

  window.renderDetected = function () {
    document.getElementById('detList').innerHTML = detected.map((item, index) => `
      <div class="swipewrap" id="dsw${index}">
        <button class="del" onclick="detDelete(${index})">🗑<br>삭제</button>
        <div class="ing pantryrow" onclick="toggleSwipeDet(${index})">
          <div class="ic">${ingredientEmoji(item.id)}</div>
          <div class="nm">${escapeHtml(ingredientName(item.id))}<em>${Number(item.c || 100)}%</em></div>
          <div class="stepper">
            <button onclick="event.stopPropagation();detQ(${index},-1)">−</button>
            <span class="q" onclick="event.stopPropagation();openKeypadDet(${index})">${formatQuantity(item.q)}</span>
            <button class="unit-btn" onclick="event.stopPropagation();openIngredientUnit('det',${index})">${escapeHtml(item.u)}</button>
            <button onclick="event.stopPropagation();detQ(${index},1)">+</button>
          </div>
        </div>
      </div>`).join('');
    document.getElementById('detCount').textContent = detected.length;
  };

  window.renderPantry = function () {
    document.getElementById('pantryCount').textContent = `${pantry.length}개`;
    document.getElementById('pantryList').innerHTML = pantry.map((item, index) => `
      <div class="swipewrap" id="sw${index}">
        <button class="del" onclick="doDelete(${index})">🗑<br>삭제</button>
        <div class="ing pantryrow" onclick="toggleSwipe(${index})">
          <div class="ic">${escapeHtml(item.e || ingredientEmoji(item.id))}</div>
          <div class="nm">${escapeHtml(item.n || ingredientName(item.id))}${expChip(Number.isFinite(Number(item.exp)) ? Number(item.exp) : 7)}<small>냉장 보관</small></div>
          <div class="stepper">
            <button onclick="event.stopPropagation();pq(${index},-1)">−</button>
            <span class="q" onclick="event.stopPropagation();openKeypad(${index})">${formatQuantity(item.q)}</span>
            <button class="unit-btn" onclick="event.stopPropagation();openIngredientUnit('pantry',${index})">${escapeHtml(item.u)}</button>
            <button onclick="event.stopPropagation();pq(${index},1)">+</button>
          </div>
        </div>
      </div>`).join('');
    persistPantry();
    renderCook();
    refreshRecipeAvailability();
  };

  window.toggleCustomUnit = function () {
    const isCustom = document.getElementById('customIngUnit').value === 'custom';
    document.getElementById('customUnitWrap').hidden = !isCustom;
  };

  window.resetCustomIngredientEditor = function () {
    const nameInput = document.getElementById('customIngName');
    const quantityInput = document.getElementById('customIngQty');
    const unitSelect = document.getElementById('customIngUnit');
    const customUnitInput = document.getElementById('customIngCustomUnit');
    if (nameInput) nameInput.value = '';
    if (quantityInput) quantityInput.value = '1';
    if (unitSelect) unitSelect.value = '개';
    if (customUnitInput) customUnitInput.value = '';
    if (unitSelect) toggleCustomUnit();
  };

  function resolveIngredientId(name) {
    const trimmed = name.trim();
    const aliases = { 계란: 'egg', 달걀: 'egg', 소고기: 'beef', 밥: 'rice', 쯔유: 'tsuyu', 미림: 'mirin', 설탕: 'sugar' };
    if (aliases[trimmed]) return aliases[trimmed];
    const known = Object.keys(NAME).find(id => NAME[id] === trimmed);
    return known || `custom:${trimmed}`;
  }

  window.addCustomIngredient = function () {
    const nameInput = document.getElementById('customIngName');
    const quantityInput = document.getElementById('customIngQty');
    const unitSelect = document.getElementById('customIngUnit');
    const customUnitInput = document.getElementById('customIngCustomUnit');
    const name = nameInput.value.trim();
    const quantity = Number(quantityInput.value);
    const unit = unitSelect.value === 'custom' ? customUnitInput.value.trim() : unitSelect.value;
    if (!name) {
      toast('재료명을 입력해 주세요');
      nameInput.focus();
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast('0보다 큰 수량을 입력해 주세요');
      quantityInput.focus();
      return;
    }
    if (!unit) {
      toast('단위를 입력해 주세요');
      customUnitInput.focus();
      return;
    }
    const id = resolveIngredientId(name);
    NAME[id] = name;
    if (!EMO[id]) EMO[id] = '🥄';
    const target = addTarget === 'det' ? detected : pantry;
    const existing = target.find(item => item.id === id || item.n === name);
    if (existing) {
      existing.q = quantity;
      existing.u = unit;
      if (addTarget === 'det') existing.c = 100;
    } else if (addTarget === 'det') {
      target.push({ id, q: quantity, u: unit, c: 100 });
    } else {
      target.push(pantryItem(id, name, quantity, unit, 7));
    }
    nameInput.value = '';
    quantityInput.value = '1';
    customUnitInput.value = '';
    unitSelect.value = '개';
    toggleCustomUnit();
    if (addTarget === 'det') renderDetected();
    else renderPantry();
    renderAdd();
    toast(`${name} ${formatQuantity(quantity)}${unit}을 추가했어요`);
  };

  window.openIngredientUnit = function (target, index) {
    unitEdit = { target, index };
    const item = target === 'det' ? detected[index] : pantry[index];
    document.getElementById('unitIngName').textContent = target === 'det' ? ingredientName(item.id) : item.n;
    document.getElementById('unitCurrent').textContent = item.u;
    const select = document.getElementById('unitSelect');
    if (KNOWN_UNITS.includes(item.u)) {
      select.value = item.u;
      document.getElementById('unitEditorCustomWrap').hidden = true;
    } else {
      select.value = 'custom';
      document.getElementById('unitEditorCustom').value = item.u;
      document.getElementById('unitEditorCustomWrap').hidden = false;
    }
    openSheet('sheet-unit');
  };

  window.toggleUnitEditorCustom = function () {
    document.getElementById('unitEditorCustomWrap').hidden = document.getElementById('unitSelect').value !== 'custom';
  };

  window.saveIngredientUnit = function () {
    if (!unitEdit) return;
    const select = document.getElementById('unitSelect');
    const unit = select.value === 'custom' ? document.getElementById('unitEditorCustom').value.trim() : select.value;
    if (!unit) {
      toast('단위를 입력해 주세요');
      return;
    }
    const item = unitEdit.target === 'det' ? detected[unitEdit.index] : pantry[unitEdit.index];
    item.u = unit;
    closeSheet();
    if (unitEdit.target === 'det') renderDetected();
    else renderPantry();
    toast('단위를 수정했어요');
  };

  function pantryHasRequirement(requirement) {
    const item = pantry.find(pantryItemValue => pantryItemValue.id === requirement.id && Number(pantryItemValue.q) > 0);
    if (!item) return false;
    if (!Number.isFinite(Number(requirement.amount))) return true;
    const ownedUnit = String(item.u || '').toLowerCase();
    const requiredUnit = String(requirement.unit || '').toLowerCase();
    if (ownedUnit === requiredUnit) return Number(item.q) >= Number(requirement.amount);

    const scale = { g: 1, kg: 1000, ml: 1, l: 1000 };
    const ownedFamily = ownedUnit === 'g' || ownedUnit === 'kg' ? 'mass' : ownedUnit === 'ml' || ownedUnit === 'l' ? 'volume' : '';
    const requiredFamily = requiredUnit === 'g' || requiredUnit === 'kg' ? 'mass' : requiredUnit === 'ml' || requiredUnit === 'l' ? 'volume' : '';
    if (ownedFamily && ownedFamily === requiredFamily) {
      return Number(item.q) * scale[ownedUnit] >= Number(requirement.amount) * scale[requiredUnit];
    }
    return false;
  }

  function missingRequirements(recipe) {
    return recipe.ing.filter(item => item.required !== false && !pantryHasRequirement(item));
  }

  function requirementText(requirement) {
    return `${requirement.n}${Number.isFinite(Number(requirement.amount)) ? ` ${formatQuantity(requirement.amount)}${requirement.unit || ''}` : ''}`;
  }

  window.missing = function (recipe) {
    return missingRequirements(recipe).map(item => item.n);
  };

  window.haveRate = function (recipe) {
    if (!recipe.ing.length) return 100;
    return Math.round((recipe.ing.length - missingRequirements(recipe).length) / recipe.ing.length * 100);
  };

  function renderAvailability(recipe) {
    const missingItems = missingRequirements(recipe);
    if (!missingItems.length) {
      return '<div class="required-ready">필수 재료가 모두 준비됐어요 ✓</div>';
    }
    const first = missingItems[0];
    const headline = missingItems.length === 1
      ? `${requirementText(first)}이 필요해요.`
      : `필수 재료 ${missingItems.length}가지가 필요해요.`;
    return `<div class="required-alert">
      <strong>부족한 재료가 있어요</strong>
      <div>${escapeHtml(headline)}<br>재료를 준비한 뒤 요리를 시작해 주세요.</div>
      <div class="missing-list">${missingItems.map(requirementText).map(escapeHtml).join(' · ')}</div>
      <div class="required-actions">
        <button class="btn gray sm" type="button" onclick="openRequiredIngredientAdder()">재료 추가하기</button>
        <button class="btn ghost sm" type="button" onclick="markRequiredPrepared()">준비했어요</button>
      </div>
    </div>`;
  }

  window.openRequiredIngredientAdder = function () {
    addTarget = 'pantry';
    openSheet('sheet-add');
  };

  window.markRequiredPrepared = function () {
    if (!cur) return;
    missingRequirements(cur).forEach(requirement => {
      const quantity = Number.isFinite(Number(requirement.amount)) ? Number(requirement.amount) : 1;
      const existing = pantry.find(item => item.id === requirement.id);
      if (existing) {
        existing.q = quantity;
        existing.u = requirement.unit || existing.u || '개';
      } else {
        pantry.push(pantryItem(requirement.id, requirement.n, quantity, requirement.unit || '개', 7));
      }
    });
    renderPantry();
    refreshRecipeAvailability();
    toast('준비한 필수 재료를 목록에 반영했어요');
  };

  function refreshRecipeAvailability() {
    const view = document.getElementById('v-recipe');
    if (!cur || !view.classList.contains('on')) return;
    const missingItems = missingRequirements(cur);
    document.getElementById('rMissing').innerHTML = renderAvailability(cur);
    const startButton = document.getElementById('recipeStartBtn');
    startButton.disabled = missingItems.length > 0;
    startButton.textContent = missingItems.length ? '필수 재료를 먼저 준비해 주세요' : '이 메뉴로 요리 시작!';
  }

  window.renderCook = function () {
    renderChips();
    const top = topFor(sel.who, sel.concept);
    const others = RECIPES.filter(recipe => recipe.who.includes(sel.who) && recipe.id !== top.id);
    const pool = others.length ? others : RECIPES.filter(recipe => recipe.id !== top.id).slice(0, 3);
    const missingItems = missingRequirements(top);
    const rate = haveRate(top);
    document.getElementById('cookHeadline').innerHTML = `<span class="hl">${conceptWord(sel.concept)} 메뉴</span> 1개예요`;
    document.getElementById('planPill').textContent = `PLAN · ${CW[sel.who]}`;
    document.getElementById('topReco').innerHTML = `
      <div class="hero" onclick="openRecipe('${top.id}')">
        ${mediaFrame(recipeHeroSource(top), top.n, '메뉴 이미지 준비 중', 'hero-media', conceptWord(top.concept))}
        <button class="fav" onclick="event.stopPropagation();quickFav('${top.id}')">${favs.has(top.id) ? '❤️' : '♡'}</button>
        <div class="b">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:2px"><span class="pill o">1순위</span><span class="cat">${conceptWord(top.concept)} · ${top.serves}인분</span></div>
          <h3>${escapeHtml(top.n)}</h3>
          <div class="meta"><span>⏱ ${top.time}분</span><span>🥄 ${top.diff}</span><span>🔥 ${top.kcal}kcal</span></div>
          <div style="font-size:11.5px;font-weight:700;margin-top:8px;color:${missingItems.length ? 'var(--o)' : 'var(--green)'}">보유 재료 ${rate}%${missingItems.length ? ` · 장보기 필요: ${missingItems.map(item => item.n).join(', ')}` : ' · 바로 만들 수 있어요 ✓'}</div>
          <div style="height:12px"></div>
          <button class="btn sm" onclick="event.stopPropagation();openRecipe('${top.id}')">메뉴 상세 보기</button>
        </div>
      </div>`;
    document.getElementById('otherReco').innerHTML = pool.map(recipe => mrow(recipe)).join('');
  };

  window.mrow = function (recipe) {
    const missingItems = missingRequirements(recipe);
    return `<div class="mrow" onclick="openRecipe('${recipe.id}')">
      ${mediaFrame(recipeHeroSource(recipe), recipe.n, '메뉴 이미지 준비 중', 'thumb-media')}
      <div style="flex:1;min-width:0">
        <div class="n">${escapeHtml(recipe.n)} <span style="font-size:10px;color:var(--mute);font-weight:700">${conceptWord(recipe.concept)}</span></div>
        <div class="s">⏱ ${recipe.time}분 · ${recipe.diff} · ${recipe.kcal}kcal</div>
        <div class="s" style="color:${missingItems.length ? 'var(--o)' : 'var(--green)'}">${missingItems.length ? `장보기 필요 · ${missingItems.slice(0, 2).map(item => item.n).join(', ')}${missingItems.length > 2 ? ' 외' : ''}` : '필수 재료 충분 ✓'}</div>
      </div><span style="color:var(--mute)">›</span>
    </div>`;
  };

  window.numrow = function (recipe, index) {
    const missingItems = missingRequirements(recipe);
    return `<div class="mrow" onclick="openRecipe('${recipe.id}')">
      ${mediaFrame(recipeHeroSource(recipe), recipe.n, '메뉴 이미지 준비 중', 'thumb-media')}
      <div style="flex:1;min-width:0"><div class="n">${index}. ${escapeHtml(recipe.n)}</div>
      <div class="s">${CW[recipe.who[0]]} · ${recipe.serves}인분 · 예상 ${recipe.time}분</div>
      <div class="s">${missingItems.length ? `부족 ${missingItems.length}가지` : '필수 재료 충분 ✓'} · ${recipe.kcal}kcal</div></div>
      <span style="color:var(--mute)">›</span>
    </div>`;
  };

  window.openRecipe = function (id, direct) {
    cur = R(id);
    const heroWrap = document.getElementById('rHeroWrap');
    heroWrap.innerHTML = mediaContent(recipeHeroSource(cur), cur.n, '메뉴 이미지 준비 중', `${CW[cur.who[0]]} · ${conceptWord(cur.concept)}`);
    document.getElementById('rCat').textContent = `${CW[cur.who[0]]} · ${conceptWord(cur.concept)}`;
    document.getElementById('rName').textContent = cur.n;
    document.getElementById('rMeta').innerHTML = `<span>⏱ ${cur.time}분</span><span>🥄 ${cur.diff}</span><span>👥 ${cur.serves}인분</span><span>🔥 ${cur.kcal}kcal</span>`;
    document.getElementById('rDesc').textContent = cur.desc;
    const missingItems = missingRequirements(cur);
    document.getElementById('rIng').innerHTML = cur.ing.map(item => {
      const isMissing = missingItems.includes(item);
      const amount = Number.isFinite(Number(item.amount)) ? `<small>${formatQuantity(item.amount)}${item.unit || ''}</small>` : '';
      return `<div class="i ${isMissing ? 'miss' : ''}"><div class="b">${item.e}</div><div class="l">${escapeHtml(item.n)}${amount}</div></div>`;
    }).join('');
    document.getElementById('rMissing').innerHTML = renderAvailability(cur);
    document.getElementById('rSteps').innerHTML = cur.steps.map((step, index) => `<div class="stepline"><span class="n">${index + 1}</span>${escapeHtml(stepTitle(step))}</div>`).join('');
    document.getElementById('favBtn').textContent = favs.has(cur.id) ? '❤️' : '♡';
    const startButton = document.getElementById('recipeStartBtn');
    startButton.disabled = missingItems.length > 0;
    startButton.textContent = missingItems.length ? '필수 재료를 먼저 준비해 주세요' : '이 메뉴로 요리 시작!';
    go('recipe');
    if (direct && !missingItems.length) setTimeout(startCoach, 380);
  };

  window.startCoach = function () {
    if (!cur) return;
    const missingItems = missingRequirements(cur);
    if (missingItems.length) {
      toast(`${requirementText(missingItems[0])}이 필요해요`);
      refreshRecipeAvailability();
      return;
    }
    stepIdx = 0;
    go('coach');
    renderStep();
  };

  window.renderStep = function () {
    const step = cur.steps[stepIdx];
    const count = cur.steps.length;
    const title = stepTitle(step);
    const image = stepImageSource(cur, step);
    document.getElementById('cName').textContent = cur.n;
    document.getElementById('cNo').textContent = stepIdx + 1;
    document.getElementById('cTot').textContent = count;
    document.getElementById('cProg').style.width = `${(stepIdx + 1) / count * 100}%`;
    document.getElementById('cBig').textContent = title;
    document.getElementById('cSm').innerHTML = escapeHtml(stepDescription(step)).replace(/\n/g, '<br>');
    document.getElementById('cPhoto').innerHTML = `${mediaFrame(image, `STEP ${stepIdx + 1} · ${title}`, '조리 과정 이미지 준비 중', 'coach-step-media', `STEP ${stepIdx + 1}`)}
      <div class="ctimer" id="ctimer"><div class="tt" id="cTimerTxt">--:--</div></div>`;
    const previous = document.getElementById('prevStepBtn');
    const next = document.getElementById('nextStepBtn');
    previous.disabled = stepIdx === 0;
    next.textContent = stepIdx === count - 1 ? '요리 완성하기' : '다음 단계 ›';
    elapsed = stepSeconds(step);
    running = true;
    document.getElementById('playBtn').textContent = '⏸';
    tick();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  };

  window.prevStep = function () {
    if (stepIdx <= 0) return;
    stepIdx -= 1;
    renderStep();
  };

  window.renderStepsSheet = function () {
    document.getElementById('stepsBody').innerHTML = cur.steps.map((step, index) => `
      <div class="stepline ${index < stepIdx ? 'done' : ''}" style="${index === stepIdx ? 'box-shadow:0 0 0 1.5px var(--o) inset' : ''}" onclick="closeSheet();stepIdx=${index};renderStep()">
        <span class="n">${index < stepIdx ? '✓' : index + 1}</span>${escapeHtml(stepTitle(step))}<span style="margin-left:auto;font-size:11px;color:var(--mute)">${Math.max(1, Math.round(stepSeconds(step) / 60))}분</span>
      </div>`).join('');
  };

  window.renderHelp = function () {
    const step = cur.steps[stepIdx];
    const help = step.help;
    const current = help
      ? `<div class="current-help-label">현재 STEP ${stepIdx + 1}에서 자주 생기는 문제</div>
         <div class="qa current-help-card open"><div class="qq">🙋 ${escapeHtml(help.question)}</div><div class="aa" style="display:block">→ ${escapeHtml(help.answer)}</div></div>`
      : `<div class="current-help-label">현재 STEP ${stepIdx + 1} 도움말</div><div class="day-empty">현재 단계 도움말은 상세 원본 확인 중이에요.</div>`;
    document.getElementById('helpBody').innerHTML = current;
  };

  window.finish = function () {
    clearInterval(timerId);
    lastMeal = cur;
    const tag = cur.concept === 'balanced' ? '균형 잡힌 한 끼' : cur.concept === 'fancy' ? '근사한 한 끼' : '간편한 한 끼';
    document.getElementById('doneTitle').textContent = tag;
    document.getElementById('doneTag').textContent = tag;
    document.getElementById('doneDs').textContent = cur.concept === 'balanced' ? '단백질과 채소를 고르게 챙겼어요.' : cur.concept === 'fancy' ? '정성 가득한 한 접시를 완성했어요.' : '빠르고 든든하게 완성했어요.';
    document.getElementById('doneHeroWrap').innerHTML = mediaContent(recipeHeroSource(cur), cur.n, '메뉴 이미지 준비 중', 'REVIEW');
    document.getElementById('doneTime').innerHTML = `${cur.time}<i>분</i>`;
    document.getElementById('doneIng').innerHTML = `${cur.ing.length}<i>개</i>`;
    document.getElementById('doneRate').innerHTML = `${haveRate(cur)}<i>%</i>`;
    const owned = ownedSet();
    const used = cur.ing.filter(item => owned.has(item.id)).slice(0, 4);
    const shown = used.length ? used : cur.ing.slice(0, 4);
    document.getElementById('doneUsed').innerHTML = shown.map(item => `<div class="u"><div class="e">${item.e}</div><div class="n">${escapeHtml(item.n)}</div></div>`).join('');
    go('done', false);
  };

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function demoMealRecord(recipeId, daysAgo, mealType, hour, minute) {
    const completed = new Date();
    completed.setDate(completed.getDate() - daysAgo);
    completed.setHours(hour, minute, 0, 0);
    const recipe = R(recipeId);
    return {
      id: `demo-${localDateKey(completed)}-${recipeId}-${hour}${minute}`,
      recipeId: recipe && recipe.storageId ? recipe.storageId : recipeId,
      recipeName: recipe ? recipe.n : recipeId,
      completedAt: completed.toISOString(),
      date: localDateKey(completed),
      mealType,
      isDemo: true
    };
  }

  function demoMealHistory() {
    return [
      demoMealRecord('poke', 1, '점심', 12, 30),
      demoMealRecord('yubu', 2, '아침', 8, 10),
      demoMealRecord('gyudon', 2, '저녁', 19, 20),
      demoMealRecord('shabu', 3, '저녁', 19, 5),
      demoMealRecord('garlicshrimp', 4, '저녁', 19, 40),
      demoMealRecord('dubu', 5, '점심', 12, 15),
      demoMealRecord('salmon', 6, '저녁', 18, 50)
    ];
  }

  function demoMealsAlreadySeeded() {
    try {
      return localStorage.getItem(STORAGE_KEYS.demoMealsSeeded) === '1';
    } catch (error) {
      return false;
    }
  }

  function markDemoMealsSeeded() {
    try {
      localStorage.setItem(STORAGE_KEYS.demoMealsSeeded, '1');
    } catch (error) {
      // Storage may be unavailable in a private or file preview context.
    }
  }

  function ensureDemoMealHistory() {
    if (mealHistory.length || demoMealsAlreadySeeded()) return false;
    mealHistory = demoMealHistory();
    saveMealHistory();
    markDemoMealsSeeded();
    return true;
  }

  function mealTypeFor(date) {
    const hour = date.getHours();
    if (hour < 11) return '아침';
    if (hour < 17) return '점심';
    return '저녁';
  }

  function mealTime(record) {
    const date = new Date(record.completedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function mealEmoji(recipeId) {
    if (recipeId === GYUDON_ID || recipeId === 'gyudon') return '🍚';
    if (String(recipeId).includes('poke')) return '🥗';
    return '🍳';
  }

  function saveMealHistory() {
    writeStoredArray(STORAGE_KEYS.meals, mealHistory);
  }

  function monthMealCount(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return mealHistory.filter(record => String(record.date).startsWith(prefix)).length;
  }

  function calculateStreak() {
    const dates = new Set(mealHistory.map(record => record.date).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(String(date))));
    if (!dates.size) return 0;
    const todayKey = localDateKey(new Date());
    const anchorKey = dates.has(todayKey)
      ? todayKey
      : Array.from(dates).filter(date => date <= todayKey).sort().pop();
    if (!anchorKey) return 0;
    const parts = anchorKey.split('-').map(Number);
    let cursor = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    let count = 0;
    while (dates.has(localDateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function updateMealStats() {
    mealsThisMonth = monthMealCount(new Date().getFullYear(), new Date().getMonth());
    streak = calculateStreak();
    document.getElementById('msMeals').textContent = `${mealsThisMonth}끼`;
    document.getElementById('msStreak').textContent = `연속 ${streak}일`;
  }

  function ensureReportMediaFrame() {
    const image = document.getElementById('repImg');
    if (!image || image.parentElement.classList.contains('report-thumb-media')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'media-frame report-thumb-media';
    image.parentNode.insertBefore(wrapper, image);
    wrapper.appendChild(image);
  }

  function setReportMeal(recipe) {
    document.getElementById('repMeal').textContent = recipe.n;
    ensureReportMediaFrame();
    const wrapper = document.querySelector('.report-thumb-media');
    if (!wrapper) return;
    wrapper.innerHTML = mediaContent(recipeHeroSource(recipe), recipe.n, '메뉴 이미지 준비 중', 'REVIEW');
  }

  let completedMealToken = '';
  let recordedMealToken = '';

  const phase2Finish = window.finish;
  window.finish = function () {
    completedMealToken = `${Date.now()}-${cur ? cur.id : 'meal'}`;
    recordedMealToken = '';
    phase2Finish();
  };

  window.recordMeal = function () {
    if (!cur) return;
    if (!completedMealToken) completedMealToken = `${Date.now()}-${cur.id}`;
    if (recordedMealToken === completedMealToken) {
      go('mypage', false);
      return;
    }
    recordedMealToken = completedMealToken;
    const now = new Date();
    const record = {
      id: `meal-${completedMealToken}`,
      recipeId: cur.storageId || cur.id,
      recipeName: cur.n,
      completedAt: now.toISOString(),
      date: localDateKey(now),
      mealType: mealTypeFor(now),
      isDemo: false
    };
    mealHistory.push(record);
    saveMealHistory();
    cur.ing.forEach(requirement => {
      const item = pantry.find(pantryItemValue => pantryItemValue.id === requirement.id);
      if (!item) return;
      if (Number.isFinite(Number(requirement.amount)) && String(item.u).toLowerCase() === String(requirement.unit).toLowerCase()) {
        item.q = Math.max(0, Number(item.q) - Number(requirement.amount));
      } else {
        item.q = Math.max(0, Number(item.q) - 1);
      }
    });
    pantry = pantry.filter(item => Number(item.q) > 0);
    persistPantry();
    lastMeal = cur;
    setReportMeal(cur);
    updateMealStats();
    renderPantry();
    renderCook();
    renderCal();
    renderSamsi();
    go('mypage', false);
    toast(`오늘의 ${cur.n}을 기록했어요`);
  };

  window.renderCal = function () {
    document.getElementById('calM').innerHTML = `${MONTHS[calMonth]}<small>${calYear}</small>`;
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();
    let html = '';
    for (let index = 0; index < first; index += 1) html += '<div class="d"></div>';
    for (let day = 1; day <= days; day += 1) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const records = mealHistory.filter(record => record.date === key);
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
      const emoji = records.length ? mealEmoji(records[records.length - 1].recipeId) : day;
      html += `<button class="d ${records.length ? 'has' : ''} ${isToday ? 'today' : ''}" onclick="dayTap(${day})" aria-label="${calMonth + 1}월 ${day}일, 요리 ${records.length}개">${emoji}${records.length ? `<span>${day}</span><b class="meal-count">${records.length}</b>` : ''}</button>`;
    }
    document.getElementById('calGrid').innerHTML = html;
    updateMealStats();
  };

  window.dayTap = function (day) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const records = mealHistory.filter(record => record.date === key);
    document.getElementById('daySheetTitle').textContent = `${calMonth + 1}월 ${day}일`;
    document.getElementById('dayMealsBody').innerHTML = records.length
      ? `<div class="grouplabel">먹은 메뉴</div>${records.map(record => `<div class="day-meal-card"><div class="meal-icon">${mealEmoji(record.recipeId)}</div><div><strong>${escapeHtml(record.recipeName)}</strong><span>${escapeHtml(record.mealType || '식사')} · ${escapeHtml(mealTime(record))}</span></div></div>`).join('')}`
      : '<div class="day-empty">이날은 기록된 요리가 없어요.</div>';
    openSheet('sheet-day');
  };

  window.renderSamsi = function () {
    const todayKey = localDateKey(new Date());
    const records = mealHistory.filter(record => record.date === todayKey);
    document.getElementById('samsiLabel').textContent = '오늘의 요리';
    document.getElementById('samsiBody').innerHTML = records.length
      ? records.map(record => `<div class="r"><div class="e">${mealEmoji(record.recipeId)}</div><div><div class="when">${escapeHtml(record.mealType || '식사')} · ${escapeHtml(mealTime(record))}</div><div class="nm">${escapeHtml(record.recipeName)}</div></div></div>`).join('')
      : '<div class="day-empty">오늘 기록한 요리가 아직 없어요.</div>';
  };

  window.updateReminderSetting = function (field, value) {
    if (field === 'cookTime' || field === 'weeklyTime') {
      const fallback = field === 'cookTime' ? reminderSettings.cookTime : reminderSettings.weeklyTime;
      reminderSettings[field] = validReminderTime(value, fallback);
    } else if (field === 'weeklyDay') {
      if (REMINDER_DAYS.some(day => day[0] === value)) reminderSettings.weeklyDay = value;
    } else if (field === 'fridgeDays') {
      reminderSettings.fridgeDays = Math.min(30, Math.max(1, Math.round(Number(value) || DEFAULT_REMINDER_SETTINGS.fridgeDays)));
    } else {
      return;
    }
    if (!persistReminderSettings()) toast('리마인드 설정을 저장하지 못했어요');
    renderNoti();
  };

  window.updateReminderClock = function (field, part, value) {
    if (field !== 'cookTime' && field !== 'weeklyTime') return;
    const current = reminderTimeParts(reminderSettings[field]);
    const period = part === 'period' ? value : current.period;
    const time12 = part === 'time' ? value : current.time12;
    const time24 = reminderTimeTo24(period, time12);
    if (time24) window.updateReminderSetting(field, time24);
  };

  window.renderNoti = function () {
    const soon = pantry.filter(item => Number(item.exp) <= 4);
    const cookTime = reminderTimeParts(reminderSettings.cookTime);
    const weeklyTime = reminderTimeParts(reminderSettings.weeklyTime);
    document.getElementById('notiBody').innerHTML = `
      <div class="grouplabel">유통기한 리마인드</div>
      ${soon.length ? soon.map(item => `<div class="stepline"><span style="font-size:17px">${escapeHtml(item.e)}</span>${escapeHtml(item.n)} · <b style="color:var(--o)">D-${Number(item.exp)}</b><span style="margin-left:auto;font-size:11px;color:var(--mute)">${formatQuantity(item.q)}${escapeHtml(item.u)}</span></div>`).join('') : '<div class="stepline">임박한 재료가 없어요 ✓</div>'}
      <div class="grouplabel reminder-heading">알림 설정</div>
      <div class="reminder-row">
        <span class="reminder-icon" aria-hidden="true">🍳</span>
        <div class="reminder-copy"><strong>요리 시작 리마인드</strong><small>매일</small></div>
        <div class="reminder-controls reminder-clock-controls">
          <select class="reminder-control reminder-period" aria-label="요리 시작 리마인드 오전 오후" onchange="updateReminderClock('cookTime','period',this.value)">
            <option value="am"${cookTime.period === 'am' ? ' selected' : ''}>오전</option>
            <option value="pm"${cookTime.period === 'pm' ? ' selected' : ''}>오후</option>
          </select>
          <select class="reminder-control reminder-clock" aria-label="요리 시작 리마인드 시간" onchange="updateReminderClock('cookTime','time',this.value)">
            ${reminderTimeOptions(cookTime.time12)}
          </select>
        </div>
      </div>
      <div class="reminder-row reminder-row-weekly">
        <span class="reminder-icon" aria-hidden="true">📊</span>
        <div class="reminder-copy"><strong>주간 영양 리포트</strong><small>매주</small></div>
        <div class="reminder-controls">
          <select class="reminder-control reminder-day" aria-label="주간 영양 리포트 요일" onchange="updateReminderSetting('weeklyDay',this.value)">
            ${REMINDER_DAYS.map(day => `<option value="${day[0]}"${day[0] === reminderSettings.weeklyDay ? ' selected' : ''}>${day[1]}</option>`).join('')}
          </select>
          <select class="reminder-control reminder-period" aria-label="주간 영양 리포트 오전 오후" onchange="updateReminderClock('weeklyTime','period',this.value)">
            <option value="am"${weeklyTime.period === 'am' ? ' selected' : ''}>오전</option>
            <option value="pm"${weeklyTime.period === 'pm' ? ' selected' : ''}>오후</option>
          </select>
          <select class="reminder-control reminder-clock" aria-label="주간 영양 리포트 시간" onchange="updateReminderClock('weeklyTime','time',this.value)">
            ${reminderTimeOptions(weeklyTime.time12)}
          </select>
        </div>
      </div>
      <div class="reminder-row">
        <span class="reminder-icon reminder-fridge-icon" aria-hidden="true"><span class="fridge-emoji"></span></span>
        <div class="reminder-copy"><strong>냉장고 재촬영 안내</strong><small>촬영 주기</small></div>
        <label class="reminder-number"><input class="reminder-control" type="number" min="1" max="30" step="1" inputmode="numeric" value="${reminderSettings.fridgeDays}" aria-label="냉장고 재촬영 안내 주기" onchange="updateReminderSetting('fridgeDays',this.value)"><span>일마다</span></label>
      </div>
      <p class="reminder-prototype-note">설정값은 이 기기에 저장되며 실제 알림 전송은 지원하지 않아요.</p>
      <div style="height:12px"></div><button class="btn sm" onclick="closeSheet()">닫기</button>`;
  };

  window.doReset = function () {
    pantry = JSON.parse(JSON.stringify(SEED));
    mealHistory = [];
    favs = new Set(['gyudon']);
    sel = { who: 'two', concept: 'simple' };
    filter = 'simple';
    const today = new Date();
    calMonth = today.getMonth();
    calYear = today.getFullYear();
    scanSession = createScanSession();
    try { localStorage.removeItem(STORAGE_KEYS.demoMealsSeeded); } catch (error) {}
    ensureDemoMealHistory();
    writeStoredArray(STORAGE_KEYS.pantry, pantry);
    writeStoredArray(STORAGE_KEYS.meals, mealHistory);
    closeModal();
    renderPantry();
    renderCook();
    renderMenuList();
    renderCal();
    renderSamsi();
    go('home', false);
    setScanPhase('fridge');
    toast('데모를 초기화했어요');
  };

  function initializePhase2() {
    addIngredientVocabulary();
    syncGyudonRecipe();
    syncRecipeMedia();
    syncRecipeStepHelp();
    loadPantry();
    mealHistory = mealHistory.filter(record => record && record.id && record.recipeName && record.date);
    ensureDemoMealHistory();
    const today = new Date();
    calMonth = today.getMonth();
    calYear = today.getFullYear();
    document.getElementById('segF').onclick = () => setMode('fridge');
    document.getElementById('segR').onclick = () => setMode('receipt');
    ensureReportMediaFrame();
    setReportMeal(R('poke'));
    setScanPhase('fridge');
    renderPantry();
    renderCook();
    renderMenuList();
    renderCal();
    renderSamsi();
  }

  window.CookCoachPhase2 = {
    getScanSession: () => JSON.parse(JSON.stringify(scanSession)),
    getMealHistory: () => JSON.parse(JSON.stringify(mealHistory)),
    getReminderSettings: () => JSON.parse(JSON.stringify(reminderSettings)),
    getRecipeStepHelp: recipeId => {
      const recipe = R(recipeId);
      return recipe ? recipe.steps.map((step, index) => ({
        step: index + 1,
        helps: JSON.parse(JSON.stringify(step.helps || (step.help ? [step.help] : [])))
      })) : [];
    },
    getMissingRequirements: recipeId => missingRequirements(R(recipeId)).map(requirementText),
    getRecipeHeroSource: recipeId => recipeHeroSource(R(recipeId)),
    getRecipeMedia: recipeId => {
      const recipe = R(recipeId);
      return recipe ? {
        id: recipe.storageId || recipe.id,
        heroPath: recipeHeroSource(recipe),
        stepImages: recipe.steps.map(step => stepImageSource(recipe, step))
      } : null;
    },
    renderRecipeHeroMedia: (recipeId, className) => {
      const recipe = R(recipeId);
      return mediaFrame(recipeHeroSource(recipe), recipe.n, '메뉴 이미지 준비 중', className || 'thumb-media');
    }
  };

  initializePhase2();
})();
