// Optional cloud account and synchronization. localStorage remains the working copy.
  const CLOUD_COLLECTIONS = ["subjects", "questions", "cards", "exams", "attempts", "reviews", "importHashes"],
    CLOUD_STATE_PREFIX = "studyroom.cloud.v1.",
    LOCAL_REVISION_KEY = "studyroom.cloud-local-revisions.v1";
  let cloudAccount = null,
    cloudStatus = "local",
    cloudInitialized = false,
    cloudApplying = false,
    cloudTimer = null,
    cloudSyncPromise = null,
    cloudMode = "login",
    cloudPendingMigration = null,
    cloudPendingConflicts = null,
    cloudMeta = null,
    cloudAdminCache = null,
    cloudAdminRange = 30;

  function cloudEmptyMeta(userId) {
    return { userId, initialized: false, clearedAt: null, cursors: {}, snapshots: {} };
  }

  function cloudLoadMeta(userId) {
    try {
      return { ...cloudEmptyMeta(userId), ...(JSON.parse(localStorage.getItem(CLOUD_STATE_PREFIX + userId) || "{}")), userId };
    } catch { return cloudEmptyMeta(userId); }
  }

  function cloudStoreMeta() {
    if (cloudAccount && cloudMeta) localStorage.setItem(CLOUD_STATE_PREFIX + cloudAccount.id, JSON.stringify(cloudMeta));
  }

  function cloudLocalRevisions() {
    try { return JSON.parse(localStorage.getItem(LOCAL_REVISION_KEY) || "{}"); }
    catch { return {}; }
  }

  function trackCloudLocalChanges() {
    if (cloudApplying) return;
    const revisions = cloudLocalRevisions(), collections = cloudLocalCollections(), now = new Date().toISOString();
    for (const collection of CLOUD_COLLECTIONS) {
      revisions[collection] ||= {};
      for (const row of collections[collection]) {
        const id = collection === "importHashes" ? row.hash : row.id;
        const data = cloudStable(row), previous = revisions[collection][id];
        if (!previous || previous.data !== data) revisions[collection][id] = { data, updatedAt: now };
      }
    }
    const profile = cloudStable(cloudLocalProfile());
    if (!revisions.profile || revisions.profile.data !== profile) revisions.profile = { data: profile, updatedAt: now };
    localStorage.setItem(LOCAL_REVISION_KEY, JSON.stringify(revisions));
  }

  function cloudLocalRevision(collection, id) {
    return cloudLocalRevisions()[collection]?.[id]?.updatedAt || null;
  }

  function cloudSetStatus(status) {
    cloudStatus = status;
    const label = document.querySelector("#profile-cloud-status");
    if (label) label.textContent = cloudStatusLabel();
  }

  function cloudStatusLabel() {
    if (!cloudAccount) return "Sign in to sync";
    return ({ synced: "Synced", syncing: "Syncing…", offline: "Offline · changes saved here", error: "Sync needs attention" })[cloudStatus] || "Signed in";
  }

  function cloudIsAdmin() {
    return !!cloudAccount && cloudAccount.role === "admin" && !cloudAccount.disabled;
  }

  function cloudPublicAccount() {
    return cloudAccount ? `${cloudAccount.firstName || ""} ${cloudAccount.lastName || ""}`.trim() || cloudAccount.email : "";
  }

  function cloudApiUrl(path) {
    const base = String(window.STUDYROOM_API_BASE || "").replace(/\/$/, "");
    return `${base}${path}`;
  }

  async function cloudRequest(path, options = {}) {
    const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
    let response;
    try {
      response = await fetch(cloudApiUrl(path), {
        ...options,
        credentials: "include",
        headers,
        cache: "no-store",
      });
    } catch (error) {
      error.offline = true;
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || "The server could not complete the request.");
      error.status = response.status;
      error.code = data.error?.code;
      error.details = data.error?.details;
      throw error;
    }
    return data;
  }

  function cloudLocalCollections() {
    const exams = (db.exams || []).map((item) => {
      const { id, ...definition } = item;
      return { id, definition, deletedAt: null };
    });
    return {
      subjects: (db.subjects || []).map((item) => ({ ...item, topicAliases: item.topicAliases || [], topicDescriptions: item.topicDescriptions || {}, deletedAt: null })),
      questions: (db.questions || []).map((item) => ({
        id: item.id, subjectId: item.subjectId || "", topic: item.topic || "",
        questionType: item.type || item.questionType, text: item.text || "", options: item.options || [],
        correct: item.correct ?? null, explanation: item.explanation || "", sourceNumber: item.sourceNumber == null ? null : String(item.sourceNumber),
        importWarnings: item.importWarnings || [], deletedAt: null,
      })),
      cards: (db.cards || []).map((item) => ({ ...item, subjectId: item.subjectId || "", sourceQuestionId: item.sourceQuestionId || "", deletedAt: null })),
      exams,
      attempts: (db.attempts || []).map((item) => ({
        id: item.id, examId: item.examId || "", name: item.name || "", subjectId: item.subjectId || "",
        topicName: item.topicName || "", scope: item.scope || "", topicCounts: item.topicCounts || {},
        questions: item.questions || [], answers: item.answers || [], marked: item.marked || [],
        startedAt: item.startedAt || null, minutes: item.minutes ?? null, pass: item.pass ?? null,
        instructions: item.instructions || "", submittedAt: item.submittedAt || null,
        score: item.score ?? null, deletedAt: null,
      })),
      reviews: Object.entries(db.reviews || {}).map(([id, review]) => ({
        id, wrong: review.wrong || 0, correct: review.correct || 0,
        mastered: !!review.mastered, dismissed: !!review.dismissed, deletedAt: null,
      })),
      importHashes: (db.importHashes || []).map((hash) => ({ id: hash, hash, deletedAt: null })),
    };
  }

  function cloudLocalProfile() {
    const profile = db.profile || {};
    return {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      settings: db.settings || { theme: "midnight", dark: false },
      streak: db.streak || 0,
      lastStudy: db.lastStudy || null,
    };
  }

  function cloudDocToLocal(collection, row) {
    if (collection === "questions") return {
      id: row.id, subjectId: row.subjectId || "", topic: row.topic || "", type: row.questionType,
      text: row.text, options: row.options || [], correct: row.correct ?? null, explanation: row.explanation || "",
      sourceNumber: row.sourceNumber || null, importWarnings: row.importWarnings || [],
    };
    if (collection === "cards") {
      const { createdAt, updatedAt, deletedAt, ...fields } = row;
      return { ...fields, subjectId: row.subjectId || "", sourceQuestionId: row.sourceQuestionId || "", deletedAt: null };
    }
    if (collection === "exams") return { ...(row.definition || {}), id: row.id };
    if (collection === "reviews") return {
      id: row.id, wrong: row.wrong || 0, correct: row.correct || 0,
      mastered: !!row.mastered, dismissed: !!row.dismissed,
    };
    if (collection === "importHashes") return row.hash || row.id;
    if (collection === "subjects") {
      const { createdAt, updatedAt, deletedAt, ...fields } = row;
      return { ...fields, topicAliases: row.topicAliases || [], deletedAt: null };
    }
    if (collection === "attempts") return {
      id: row.id, examId: row.examId || "", name: row.name || "", subjectId: row.subjectId || "",
      topicName: row.topicName || "", scope: row.scope || "", topicCounts: row.topicCounts || {},
      questions: row.questions || [], answers: row.answers || [], marked: row.marked || [],
      startedAt: row.startedAt || null, minutes: row.minutes ?? null, pass: row.pass ?? null,
      instructions: row.instructions || "", submittedAt: row.submittedAt || null, score: row.score ?? null,
    };
    return row;
  }

  function cloudSnapshotValue(collection, row) {
    if (collection === "importHashes") return { id: row.id, hash: row.hash || row.id, deletedAt: null };
    if (collection === "exams") return { id: row.id, definition: row.definition || {}, deletedAt: null };
    const local = cloudDocToLocal(collection, row);
    if (collection === "subjects") {
      const { createdAt, updatedAt, deletedAt, ...fields } = local;
      return { ...fields, topicAliases: fields.topicAliases || [], topicDescriptions: fields.topicDescriptions || {}, deletedAt: null };
    }
    if (collection === "cards") {
      const { createdAt, updatedAt, deletedAt, ...fields } = local;
      return { ...fields, subjectId: fields.subjectId || "", sourceQuestionId: fields.sourceQuestionId || "", deletedAt: null };
    }
    return { ...local, deletedAt: null };
  }

  function cloudStable(value) {
    if (Array.isArray(value)) return `[${value.map(cloudStable).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${cloudStable(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function cloudSnapshot(collection, id) {
    cloudMeta.snapshots[collection] ||= {};
    return cloudMeta.snapshots[collection][id] || null;
  }

  function cloudSetSnapshot(collection, id, data, updatedAt, deletedAt = null) {
    cloudMeta.snapshots[collection] ||= {};
    cloudMeta.snapshots[collection][id] = { data, updatedAt: updatedAt || null, deletedAt: deletedAt || null };
  }

  function cloudCountLocal() {
    const collections = cloudLocalCollections();
    return CLOUD_COLLECTIONS.reduce((total, collection) => total + collections[collection].length, 0);
  }

  function cloudCountRemote(collections) {
    return CLOUD_COLLECTIONS.reduce((total, collection) => total + (collections[collection] || []).length, 0);
  }

  function cloudWipeLocalStudyData(clearedAt) {
    const profile = db.profile || {};
    db = blank();
    db.profile = {
      firstName: cloudAccount?.firstName || profile.firstName || "",
      lastName: cloudAccount?.lastName || profile.lastName || "",
      email: cloudAccount?.email || profile.email || "",
      photo: profile.photo || "",
    };
    localStorage.setItem(KEY, JSON.stringify(db));
    cloudMeta = cloudEmptyMeta(cloudAccount.id);
    cloudMeta.clearedAt = clearedAt || null;
    cloudMeta.initialized = true;
    cloudStoreMeta();
  }

  async function cloudPullAll(cursors = {}) {
    const result = Object.fromEntries(CLOUD_COLLECTIONS.map((collection) => [collection, new Map()])),
      nextCursors = { ...cursors };
    let pageTokens = {}, hasMore = true, profile = null, guard = 0;
    while (hasMore && guard++ < 200) {
      const response = await cloudRequest("/api/sync/pull", {
        method: "POST", body: JSON.stringify({ cursors: nextCursors, pageTokens, limit: 200 }),
      });
      profile = response.profile || profile;
      for (const collection of CLOUD_COLLECTIONS) {
        for (const row of response.collections?.[collection] || []) {
          const previous = result[collection].get(row.id);
          if (!previous || new Date(row.updatedAt) >= new Date(previous.updatedAt)) result[collection].set(row.id, row);
        }
        if (response.nextCursors?.[collection]) nextCursors[collection] = response.nextCursors[collection];
      }
      pageTokens = response.pageTokens || {};
      hasMore = !!response.hasMore;
    }
    if (hasMore) throw new Error("Cloud sync exceeded the page safety limit.");
    return {
      collections: Object.fromEntries(CLOUD_COLLECTIONS.map((collection) => [collection, [...result[collection].values()]])),
      nextCursors, profile,
    };
  }

  function cloudMergeLocalWithRemote(remote, preferLocal) {
    const localCollections = cloudLocalCollections();
    cloudApplying = true;
    const reviewMap = preferLocal ? { ...(db.reviews || {}) } : {};
    for (const collection of CLOUD_COLLECTIONS) {
      const remoteRows = remote.collections[collection] || [],
        localRows = localCollections[collection],
        localById = new Map(localRows.map((row) => [collection === "importHashes" ? row.hash : row.id, row]));
      const merged = [];
      for (const remoteRow of remoteRows) {
        const id = remoteRow.id,
          remoteData = cloudDocToLocal(collection, remoteRow),
          localData = localById.get(id);
        cloudSetSnapshot(collection, id, cloudSnapshotValue(collection, remoteRow), remoteRow.updatedAt, remoteRow.deletedAt);
        const localRevision = cloudLocalRevision(collection, id), localIsNewer = preferLocal && localData && localRevision && new Date(localRevision) > new Date(remoteRow.updatedAt || 0);
        if (remoteRow.deletedAt) {
          if (localIsNewer) merged.push(localData);
          else if (collection === "reviews") delete reviewMap[id];
          localById.delete(id);
          continue;
        }
        if (localIsNewer) merged.push(localData);
        else merged.push(remoteData);
        if (collection === "reviews" && !localIsNewer) reviewMap[id] = { wrong: remoteRow.wrong || 0, correct: remoteRow.correct || 0, mastered: !!remoteRow.mastered, dismissed: !!remoteRow.dismissed };
        localById.delete(id);
      }
      for (const [id, row] of localById) {
        if (preferLocal && collection === "reviews") reviewMap[id] = { wrong: row.wrong || 0, correct: row.correct || 0, mastered: !!row.mastered, dismissed: !!row.dismissed };
        else if (preferLocal) merged.push(row);
      }
      if (collection === "reviews") {
        for (const id of Object.keys(reviewMap)) {
          if (cloudMeta.snapshots.reviews?.[id]?.deletedAt) delete reviewMap[id];
        }
        db.reviews = reviewMap;
      } else if (collection === "importHashes") {
        db.importHashes = [...new Set(merged.map((row) => typeof row === "string" ? row : row.hash || row.id))];
      } else {
        db[collection] = merged;
      }
    }
    if (remote.profile) {
      const local = db.profile || {}, profileRevision = cloudLocalRevision("profile", "profile"), localProfileNewer = preferLocal && profileRevision && new Date(profileRevision) > new Date(remote.profile.updatedAt || 0);
      db.profile = {
        ...local,
        firstName: localProfileNewer ? local.firstName : remote.profile.firstName,
        lastName: localProfileNewer ? local.lastName : remote.profile.lastName,
        email: cloudAccount?.email || local.email || "",
        photo: local.photo || "",
      };
      if (!localProfileNewer) db.settings = remote.profile.settings || db.settings;
      if (!localProfileNewer) db.streak = remote.profile.streak || 0;
      if (!localProfileNewer) db.lastStudy = remote.profile.lastStudy || null;
      cloudSetSnapshot("profile", "profile", {
        firstName: remote.profile.firstName || "", lastName: remote.profile.lastName || "",
        settings: remote.profile.settings || {}, streak: remote.profile.streak || 0, lastStudy: remote.profile.lastStudy || null,
      }, remote.profile.updatedAt);
    }
    cloudMeta.cursors = remote.nextCursors || cloudMeta.cursors;
    cloudMeta.clearedAt = remote.profile?.clearedAt || cloudMeta.clearedAt || null;
    cloudMeta.initialized = true;
    localStorage.setItem(KEY, JSON.stringify(db));
    cloudStoreMeta();
    cloudApplying = false;
  }

  function cloudMigrationMarkup(localCount, remoteCount) {
    const both = localCount > 0 && remoteCount > 0;
    return `<div class="modal-backdrop"><section class="modal cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-migration-title"><button class="modal-close" data-action="cloud-dismiss-migration" aria-label="Close">×</button><div class="eyebrow">FIRST CLOUD SYNC</div><h2 id="cloud-migration-title">${both ? "Choose how to combine your study data" : "Import your local study data?"}</h2><p class="page-sub">This browser has ${localCount} saved records and your cloud account has ${remoteCount}. We’ll compare records by ID, keep tombstones, and ask before replacing a conflicting version.</p><div class="cloud-migration-actions"><button class="btn" data-action="cloud-use-remote">${both ? "Use cloud data" : "Start fresh"}</button><button class="btn primary" data-action="cloud-import-local">${both ? "Merge newest data" : "Import my data"}</button></div><small>Your browser data stays available until you choose an option.</small></section></div>`;
  }

  function cloudConflictMarkup(conflicts) {
    return `<div class="modal-backdrop"><section class="modal cloud-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-conflict-title"><div class="eyebrow">SYNC CONFLICT</div><h2 id="cloud-conflict-title">This device and cloud both changed data</h2><p class="page-sub">${conflicts.length} record${conflicts.length === 1 ? "" : "s"} changed on both sides since the last sync. Choose which version to keep.</p><div class="cloud-migration-actions"><button class="btn" data-action="cloud-keep-local">Keep this device</button><button class="btn primary" data-action="cloud-keep-remote">Use cloud version</button></div></section></div>`;
  }

  function cloudQueueMigration(remote, choice) {
    cloudPendingMigration = { remote, choice };
    modal = cloudMigrationMarkup(cloudCountLocal(), cloudCountRemote(remote.collections));
  }

  async function cloudInitializeAccount(account, { fromAuth = false } = {}) {
    if (cloudAccount?.id !== account.id) cloudAdminCache = null;
    cloudAccount = account;
    cloudMeta = cloudLoadMeta(account.id);
    cloudSetStatus("syncing");
    const remote = await cloudPullAll(cloudMeta.cursors);
    const remoteCount = cloudCountRemote(remote.collections), localCount = cloudCountLocal(),
      serverCleared = remote.profile?.clearedAt ? new Date(remote.profile.clearedAt).getTime() : 0,
      seenCleared = cloudMeta.clearedAt ? new Date(cloudMeta.clearedAt).getTime() : 0;
    const clearedNow = serverCleared > seenCleared;
    if (clearedNow) {
      cloudWipeLocalStudyData(remote.profile.clearedAt);
    }
    if (!cloudMeta.initialized) {
      if (localCount && remoteCount) {
        cloudQueueMigration(remote, "merge");
        return;
      }
      if (localCount && !remoteCount) {
        cloudQueueMigration(remote, "import");
        return;
      }
      cloudMergeLocalWithRemote(remote, false);
    } else {
      cloudApplyIncremental(remote);
    }
    cloudSetStatus("synced");
    page = "dashboard";
  }

  function cloudApplyIncremental(remote) {
    const localCollections = cloudLocalCollections(), conflicts = [],
      localMaps = Object.fromEntries(CLOUD_COLLECTIONS.map((collection) => [
        collection,
        new Map(localCollections[collection].map((row) => [collection === "importHashes" ? row.hash : row.id, row])),
      ]));
    cloudApplying = true;
    for (const collection of CLOUD_COLLECTIONS) {
      const remoteRows = remote.collections[collection] || [];
      for (const row of remoteRows) {
        const id = row.id, data = cloudDocToLocal(collection, row), snapshot = cloudSnapshot(collection, id),
          local = localMaps[collection].get(id),
          localChanged = local && (!snapshot || cloudStable(local) !== cloudStable(snapshot.data));
        if (localChanged) {
          if (!snapshot || new Date(row.updatedAt) > new Date(snapshot.updatedAt || 0)) conflicts.push({ collection, id, row, local });
          continue;
        }
        if (!local && snapshot && !snapshot.deletedAt && !row.deletedAt) {
          if (new Date(row.updatedAt) > new Date(snapshot.updatedAt || 0)) conflicts.push({ collection, id, row, local: null });
          continue;
        }
        cloudSetSnapshot(collection, id, cloudSnapshotValue(collection, row), row.updatedAt, row.deletedAt);
        if (collection === "reviews") {
          if (row.deletedAt) delete db.reviews[id];
          else db.reviews[id] = { wrong: row.wrong || 0, correct: row.correct || 0, mastered: !!row.mastered, dismissed: !!row.dismissed };
        } else if (collection === "importHashes") {
          if (row.deletedAt) db.importHashes = db.importHashes.filter((hash) => hash !== id);
          else if (!db.importHashes.includes(id)) db.importHashes.push(id);
        } else {
          const index = db[collection].findIndex((entry) => entry.id === id);
          if (row.deletedAt) {
            if (index >= 0) db[collection].splice(index, 1);
          } else if (index >= 0) db[collection][index] = data;
          else db[collection].push(data);
        }
      }
    }
    if (remote.profile) {
      const data = {
        firstName: remote.profile.firstName || "", lastName: remote.profile.lastName || "",
        settings: remote.profile.settings || {}, streak: remote.profile.streak || 0, lastStudy: remote.profile.lastStudy || null,
      }, snapshot = cloudSnapshot("profile", "profile"), current = cloudLocalProfile();
      const localChanged = snapshot && cloudStable(current) !== cloudStable(snapshot.data);
      if (localChanged) {
        if (new Date(remote.profile.updatedAt) > new Date(snapshot.updatedAt)) conflicts.push({ collection: "profile", id: "profile", row: remote.profile, local: current });
      } else {
        db.profile = { ...(db.profile || {}), firstName: data.firstName, lastName: data.lastName, email: cloudAccount.email, photo: db.profile?.photo || "" };
        db.settings = data.settings;
        db.streak = data.streak;
        db.lastStudy = data.lastStudy;
        cloudSetSnapshot("profile", "profile", data, remote.profile.updatedAt);
      }
    }
    cloudMeta.cursors = remote.nextCursors || cloudMeta.cursors;
    cloudMeta.clearedAt = remote.profile?.clearedAt || cloudMeta.clearedAt || null;
    cloudMeta.initialized = true;
    localStorage.setItem(KEY, JSON.stringify(db));
    cloudStoreMeta();
    cloudApplying = false;
    if (conflicts.length) {
      cloudPendingConflicts = conflicts;
      modal = cloudConflictMarkup(conflicts);
    }
  }

  function cloudResolveMigration(preferLocal) {
    if (!cloudPendingMigration) return;
    const remote = cloudPendingMigration.remote;
    cloudMergeLocalWithRemote(remote, preferLocal);
    cloudPendingMigration = null;
    modal = null;
    cloudSetStatus("synced");
    render();
    if (preferLocal) cloudScheduleSync(50);
  }

  function cloudResolveConflicts(keepLocal) {
    if (!cloudPendingConflicts) return;
    cloudApplying = true;
    for (const conflict of cloudPendingConflicts) {
      const { collection, id, row, local } = conflict;
      if (collection === "profile") {
        const data = {
          firstName: row.firstName || "", lastName: row.lastName || "", settings: row.settings || {},
          streak: row.streak || 0, lastStudy: row.lastStudy || null,
        };
        if (!keepLocal) {
          db.profile = { ...(db.profile || {}), firstName: data.firstName, lastName: data.lastName, email: cloudAccount.email };
          db.settings = data.settings; db.streak = data.streak; db.lastStudy = data.lastStudy;
        }
        cloudSetSnapshot("profile", "profile", data, row.updatedAt);
        continue;
      }
      const remoteData = cloudDocToLocal(collection, row);
      cloudSetSnapshot(collection, id, cloudSnapshotValue(collection, row), row.updatedAt, row.deletedAt);
      if (keepLocal) continue;
      if (collection === "reviews") {
        if (row.deletedAt) delete db.reviews[id];
        else db.reviews[id] = { wrong: row.wrong || 0, correct: row.correct || 0, mastered: !!row.mastered, dismissed: !!row.dismissed };
      } else if (collection === "importHashes") {
        db.importHashes = row.deletedAt ? db.importHashes.filter((hash) => hash !== id) : [...new Set([...db.importHashes, id])];
      } else {
        db[collection] = db[collection].filter((item) => item.id !== id);
        if (!row.deletedAt) db[collection].push(remoteData);
      }
    }
    cloudApplying = false;
    cloudPendingConflicts = null;
    cloudAdminCache = null;
    modal = null;
    localStorage.setItem(KEY, JSON.stringify(db));
    cloudStoreMeta();
    render();
    if (keepLocal) cloudScheduleSync(50);
  }

  function cloudDiff() {
    const current = cloudLocalCollections(), changes = {}, outgoing = {};
    for (const collection of CLOUD_COLLECTIONS) {
      const snapshots = cloudMeta.snapshots[collection] || {},
        currentRows = current[collection], currentIds = new Set(currentRows.map((row) => collection === "importHashes" ? row.hash : row.id));
      changes[collection] = [];
      for (const row of currentRows) {
        const id = collection === "importHashes" ? row.hash : row.id,
          snapshot = snapshots[id],
          data = row;
        if (!snapshot || cloudStable(data) !== cloudStable(snapshot.data)) {
          changes[collection].push({ ...data, id, baseUpdatedAt: snapshot?.updatedAt || null, deletedAt: row.deletedAt || null });
          outgoing[`${collection}:${id}`] = { data, id, collection, deletedAt: row.deletedAt || null };
        }
      }
      for (const [id, snapshot] of Object.entries(snapshots)) {
        if (!currentIds.has(id) && !snapshot.deletedAt) {
          const deletedAt = new Date().toISOString(), data = { ...snapshot.data, id, deletedAt };
          changes[collection].push({ ...data, baseUpdatedAt: snapshot.updatedAt });
          outgoing[`${collection}:${id}`] = { data, id, collection, deletedAt };
        }
      }
    }
    const profile = cloudLocalProfile(), profileSnapshot = cloudSnapshot("profile", "profile");
    if (!profileSnapshot || cloudStable(profile) !== cloudStable(profileSnapshot.data)) {
      changes.profile = { ...profile, baseUpdatedAt: profileSnapshot?.updatedAt || null };
      outgoing["profile:profile"] = { data: profile, id: "profile", collection: "profile", deletedAt: null };
    }
    return { changes, outgoing };
  }

  async function cloudApplyVersions(outgoing, versions) {
    for (const entry of Object.values(outgoing)) {
      const updatedAt = versions[entry.collection]?.[entry.id] || versions[entry.collection] || null;
      if (updatedAt) cloudSetSnapshot(entry.collection, entry.id, entry.data, updatedAt, entry.deletedAt);
    }
    cloudStoreMeta();
  }

  async function cloudSyncNow() {
    if (!cloudAccount || cloudApplying || cloudPendingMigration || cloudPendingConflicts) return;
    if (!navigator.onLine) { cloudSetStatus("offline"); return; }
    if (cloudSyncPromise) return cloudSyncPromise;
    cloudSyncPromise = (async () => {
      cloudSetStatus("syncing");
      try {
        let remote = await cloudPullAll(cloudMeta.cursors);
        const remoteClearedAt = remote.profile?.clearedAt ? new Date(remote.profile.clearedAt).getTime() : 0,
          localClearedAt = cloudMeta.clearedAt ? new Date(cloudMeta.clearedAt).getTime() : 0;
        if (remoteClearedAt > localClearedAt) cloudWipeLocalStudyData(remote.profile.clearedAt);
        cloudApplyIncremental(remote);
        if (cloudPendingConflicts) { cloudSetStatus("synced"); return; }
        const { changes, outgoing } = cloudDiff(), hasChanges = CLOUD_COLLECTIONS.some((name) => changes[name]?.length) || changes.profile;
        if (hasChanges) {
          const response = await cloudRequest("/api/sync/push", { method: "POST", body: JSON.stringify(changes) });
          await cloudApplyVersions(outgoing, response.versions || {});
        }
        remote = await cloudPullAll(cloudMeta.cursors);
        cloudApplyIncremental(remote);
        cloudSetStatus("synced");
      } catch (error) {
        if (error.status === 409) {
          try {
            const fresh = await cloudPullAll({});
            cloudApplyIncremental(fresh);
            cloudSetStatus("synced");
          } catch { cloudSetStatus("error"); }
        } else cloudSetStatus(error.offline || !navigator.onLine ? "offline" : "error");
      } finally { cloudSyncPromise = null; }
    })();
    return cloudSyncPromise;
  }

  function cloudScheduleSync(delay = 700) {
    if (!cloudAccount || cloudApplying || !cloudMeta?.initialized) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => cloudSyncNow(), delay);
  }

  function queueCloudSave() {
    if (!cloudAccount || cloudApplying) return;
    cloudScheduleSync();
  }

  async function initializeCloudSync() {
    if (cloudInitialized) return;
    cloudInitialized = true;
    const resetToken = new URLSearchParams(location.search).get("resetToken");
    if (resetToken) { page = "account"; return; }
    cloudSetStatus("syncing");
    try {
      const response = await cloudRequest("/api/auth/me", { method: "GET" });
      if (response.user) await cloudInitializeAccount(response.user);
      else { page = "account"; cloudSetStatus("local"); }
    } catch (error) {
      cloudAccount = null;
      cloudMeta = null;
      page = "account";
      cloudSetStatus(error.status === 401 ? "local" : "offline");
    }
  }

  async function cloudAuthSubmit(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      cloudSetStatus("syncing");
      const result = await cloudRequest(cloudMode === "register" ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify(values) });
      await cloudInitializeAccount(result.user, { fromAuth: true });
      render();
      if (!modal) notify(`Signed in as ${result.user.email}.`);
    } catch (error) {
      cloudSetStatus("error");
      notify(error.message);
    }
  }

  async function cloudLogout() {
    try { await cloudRequest("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
    cloudAccount = null;
    cloudMeta = null;
    cloudPendingMigration = null;
    cloudPendingConflicts = null;
    modal = null;
    cloudSetStatus("local");
    window.location.assign("/public/");
    notify("Signed out. This browser’s local data is still available.");
  }

  function cloudAccountPage() {
    const resetToken = new URLSearchParams(location.search).get("resetToken");
    if (resetToken) return `${pageHead("ACCOUNT SECURITY", "Choose a new password", "Reset your password, then sign in again.")}
      <form id="cloud-reset-form" class="panel cloud-auth-panel"><input type="hidden" name="token" value="${esc(resetToken)}"><label class="form-field">New password<input class="field" type="password" name="password" minlength="10" maxlength="128" required autocomplete="new-password"></label><button class="btn primary" type="submit">Reset password</button></form>`;
    if (cloudAccount) return `${pageHead("YOUR ACCOUNT", "Cloud account", "Your study data stays available in this browser and syncs when you’re online.")}${cloudProfileSettings()}`;
    return `${pageHead("STUDYROOM ACCOUNT", "Sign in to Studyroom", "Sign in to sync your account and study progress across devices.")}
      <section class="panel cloud-auth-panel"><button class="google-button" data-action="cloud-google"><span class="google-g">G</span>Continue with Google</button><form id="cloud-auth-form"><div class="form-grid">${cloudMode === "register" ? `<label class="form-field">First name<input class="field" name="firstName" maxlength="60" autocomplete="given-name"></label><label class="form-field">Last name<input class="field" name="lastName" maxlength="60" autocomplete="family-name"></label>` : ""}<label class="form-field full">Email<input class="field" type="email" name="email" maxlength="254" autocomplete="email" required></label><label class="form-field full">Password<input class="field" type="password" name="password" minlength="${cloudMode === "register" ? "10" : "1"}" maxlength="128" autocomplete="${cloudMode === "register" ? "new-password" : "current-password"}" required></label></div><button class="btn primary" type="submit">${cloudMode === "register" ? "Create account" : "Sign in"}</button><button class="btn" type="button" data-action="cloud-toggle-mode">${cloudMode === "register" ? "I already have an account" : "Create an account"}</button><button class="panel-link cloud-forgot" type="button" data-action="cloud-forgot">Forgot password?</button></form></section>`;
  }

  function cloudPage() { return cloudAccountPage(); }

  function cloudAdminPage() {
    if (!cloudIsAdmin()) return adminPage();
    if (!cloudAdminCache) {
      cloudLoadAdmin().catch((error) => { cloudAdminCache = { error: error.message }; render(); });
      return `${pageHead("PLATFORM ADMINISTRATION", "Workspace admin", "Loading live platform data…")}<section class="panel">Loading administrator data…</section>`;
    }
    if (cloudAdminCache.error) return `${pageHead("PLATFORM ADMINISTRATION", "Workspace admin", "Administrator data could not be loaded.")}<section class="panel">${esc(cloudAdminCache.error)} <button class="btn" data-action="cloud-admin-refresh">Retry</button></section>`;
    const stats = cloudAdminCache.stats, userPage = cloudAdminCache.userPage;
    return `${pageHead("PLATFORM ADMINISTRATION", "Workspace admin", "Live aggregates and account management from MongoDB.", `<label class="admin-range-label" for="cloud-admin-range">Date range</label><select class="field admin-range" id="cloud-admin-range"><option value="7" ${cloudAdminRange === 7 ? "selected" : ""}>7 days</option><option value="30" ${cloudAdminRange === 30 ? "selected" : ""}>30 days</option><option value="90" ${cloudAdminRange === 90 ? "selected" : ""}>90 days</option><option value="365" ${cloudAdminRange === 365 ? "selected" : ""}>365 days</option></select><button class="btn" data-action="cloud-admin-refresh">Refresh</button>`)}
      <div class="grid stats-grid admin-stats">${stat("Registered users", stats.users.total, `${stats.users.active} active · ${stats.users.disabled} disabled`, "♙")}${stat("Subjects", stats.content.subjects, "in all accounts", "▦")}${stat("Questions", stats.content.questions, "in all accounts", "☷")}${stat("Exam attempts", stats.content.attempts, "in all accounts", "▤")}</div>
      <section class="panel cloud-user-management"><div class="panel-head"><div><h2 class="panel-title">Accounts</h2><p class="page-sub">Joined date and last activity are shown when available.</p></div></div><div class="cloud-user-list">${userPage.users.map((user) => `<article class="cloud-user-row"><div><b>${esc(`${user.firstName} ${user.lastName}`.trim() || user.email)}</b><small>${esc(user.email)} · Joined ${esc(new Date(user.createdAt).toLocaleDateString())} · Last active ${esc(user.lastActivityAt ? new Date(user.lastActivityAt).toLocaleDateString() : "—")}</small></div><span class="badge ${user.role === "admin" ? "success" : ""}">${user.role}${user.disabled ? " · disabled" : ""}</span><div class="actions"><button class="btn" data-action="cloud-admin-role" data-id="${esc(user.id)}" data-role="${user.role === "admin" ? "user" : "admin"}" ${user.id === cloudAccount.id ? "disabled" : ""}>${user.role === "admin" ? "Make user" : "Make admin"}</button><button class="btn ${user.disabled ? "" : "danger"}" data-action="cloud-admin-disabled" data-id="${esc(user.id)}" data-disabled="${!user.disabled}" ${user.id === cloudAccount.id ? "disabled" : ""}>${user.disabled ? "Re-enable" : "Disable"}</button></div></article>`).join("")}</div>${userPage.nextCursor ? `<button class="btn" data-action="cloud-admin-more" data-cursor="${esc(userPage.nextCursor)}">Load more</button>` : ""}</section>
      <section class="panel admin-activity-panel"><div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="page-sub">Append-only server activity · last ${cloudAdminRange} days</p></div></div><div class="admin-activity-list">${(stats.recentActivity || []).map((item) => `<div class="admin-activity-row"><span class="admin-activity-mark">◷</span><div><b>${esc(item.description || item.eventType)}</b><small>${esc(item.email || "System")} · ${esc(new Date(item.createdAt).toLocaleString())}</small></div></div>`).join("") || `<p class="page-sub">No activity recorded.</p>`}</div></section>`;
  }

  async function cloudLoadAdmin(cursor = null, append = false) {
    const previous = append ? cloudAdminCache?.userPage : null;
    const [stats, userPage] = await Promise.all([
      cloudRequest(`/api/admin/stats?days=${cloudAdminRange}`),
      cloudRequest(`/api/admin/users?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
    ]);
    cloudAdminCache = { stats, userPage: append && previous ? { users: [...previous.users, ...userPage.users], nextCursor: userPage.nextCursor } : userPage };
    render();
  }

  async function cloudClearData() {
    if (!confirm("Clear all synced study data? Your account and audit history will remain.")) return;
    try {
      const result = await cloudRequest("/api/account/clear", { method: "POST", body: "{}" });
      cloudWipeLocalStudyData(result.clearedAt);
      page = "dashboard"; render(); notify("Synced study data cleared.");
    } catch (error) { notify(error.message); }
  }

  function cloudProfileSettings() {
    return cloudAccount ? `<section class="profile-account-settings"><div class="profile-account-heading"><h2>Account &amp; sync</h2><span class="badge ${cloudAccount.role === "admin" ? "success" : ""}">${cloudAccount.role === "admin" ? "Administrator" : "Account"}</span></div><p class="page-sub">Sync status: <b id="profile-cloud-status">${esc(cloudStatusLabel())}</b>. Profile photos remain on this device.</p><div class="profile-account-actions">${cloudIsAdmin() ? `<button type="button" class="btn" data-page="admin">Open Workspace Admin</button>` : ""}<button type="button" class="google-button" data-action="cloud-google"><span class="google-g">G</span>Link Google account</button><button type="button" class="btn" data-action="cloud-sync-now">Sync now</button><button type="button" class="btn danger" data-action="cloud-clear-data">Clear synced study data</button></div></section>` : "";
  }

  async function cloudHandleAction(action, event) {
    if (action === "cloud-toggle-mode") { cloudMode = cloudMode === "login" ? "register" : "login"; render(); return; }
    if (action === "cloud-signout") { if (confirm("Sign out of your Studyroom account?")) await cloudLogout(); return; }
    if (action === "cloud-sync-now") { await cloudSyncNow(); notify(cloudStatusLabel()); return; }
    if (action === "cloud-clear-data") { await cloudClearData(); return; }
    if (action === "cloud-google") {
      try {
        const result = await cloudRequest("/api/auth/google/status", { method: "GET" });
        if (!result.configured) { notify("Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in the backend environment."); return; }
        window.location.assign(cloudApiUrl("/api/auth/google"));
      } catch (error) { notify(error.message); }
      return;
    }
    if (action === "cloud-admin-refresh") { cloudAdminCache = null; render(); return; }
    if (action === "cloud-admin-more") { await cloudLoadAdmin(event.target.closest("[data-cursor]")?.dataset.cursor, true); return; }
    if (action === "cloud-admin-role" || action === "cloud-admin-disabled") {
      const button = event.target.closest("[data-id]"), isRole = action === "cloud-admin-role";
      if (!button) return;
      try {
        await cloudRequest(`/api/admin/users/${encodeURIComponent(button.dataset.id)}/${isRole ? "role" : "disabled"}`, {
          method: "PATCH", body: JSON.stringify(isRole ? { role: button.dataset.role } : { disabled: button.dataset.disabled === "true" }),
        });
        cloudAdminCache = null; await cloudLoadAdmin(); notify("Account updated.");
      } catch (error) { notify(error.message); }
      return;
    }
    if (action === "cloud-dismiss-migration") { notify("Choose an import or cloud option before syncing."); return; }
    if (action === "cloud-import-local") { cloudResolveMigration(true); return; }
    if (action === "cloud-use-remote") { cloudResolveMigration(false); return; }
    if (action === "cloud-keep-local") { cloudResolveConflicts(true); return; }
    if (action === "cloud-keep-remote") { cloudResolveConflicts(false); return; }
    if (action === "cloud-forgot") {
      const email = prompt("Enter the email address for your account:");
      if (!email) return;
      try {
        await cloudRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
        notify("If the account exists, a password reset link will be sent.");
      } catch (error) { notify(error.message); }
    }
  }

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#cloud-auth-form")) {
      event.preventDefault();
      cloudAuthSubmit(event.target);
    }
    if (event.target.matches("#cloud-reset-form")) {
      event.preventDefault();
      cloudRequest("/api/auth/reset-password", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) })
        .then(() => { history.replaceState({}, "", location.pathname); cloudMode = "login"; render(); notify("Password updated. Sign in with your new password."); })
        .catch((error) => notify(error.message));
    }
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action^='cloud-']");
    if (action) cloudHandleAction(action.dataset.action, event);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("#cloud-admin-range")) { cloudAdminRange = Number(event.target.value); cloudAdminCache = null; render(); }
  });

  window.addEventListener("online", () => { if (cloudAccount) cloudSyncNow(); });
  window.addEventListener("offline", () => { if (cloudAccount) cloudSetStatus("offline"); });
  setInterval(() => { if (cloudAccount && cloudStatus !== "syncing") cloudSyncNow(); }, 30000);
  trackCloudLocalChanges();
