const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { document: { addEventListener() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync("frontend/src/js/services/subject-transfer.js", "utf8"), context);
const api = vm.runInContext("({ createSubjectExport, validateSubjectExport, subjectTransferBuildPlan })", context);
const plain = (value) => JSON.parse(JSON.stringify(value));
const subject = {
  id: "private-subject-id", name: "Algorithms", description: "Course notes", topics: ["Sorting", "Searching"],
  topicDescriptions: { Sorting: "Sort data." }, topicAliases: [{ from: "Sort", to: "Sorting" }],
};
const questions = [
  { id: "private-q1", subjectId: subject.id, topic: "Sorting", type: "mcq", text: "Which sort?", options: ["A", "B"], correct: 1, explanation: "Details", importWarnings: ["Check wording"], sourceNumber: "7" },
  { id: "private-q2", subjectId: subject.id, topic: "Sort", type: "tf", text: "Stable?", options: [], correct: true, explanation: "", importWarnings: [] },
  { id: "private-q3", subjectId: subject.id, topic: "Searching", type: "short", text: "Name a search.", options: [], correct: "Binary", explanation: "Sorted input", importWarnings: [] },
  { id: "private-q4", subjectId: subject.id, topic: "", type: "short", text: "General question?", options: [], correct: "Answer", explanation: "", importWarnings: [] },
  { id: "other-q", subjectId: "other", topic: "Sorting", type: "short", text: "Other", options: [], correct: null, explanation: "", importWarnings: [] },
];
const exportAll = () => plain(api.createSubjectExport(subject, questions));

test("exports full subject topics, alias questions, and unassigned questions without internal IDs", () => {
  const file = exportAll();
  assert.equal(file.format, "studyroom-subject");
  assert.equal(file.version, 1);
  assert.deepEqual(file.subject.topics.map((topic) => topic.name), ["Sorting", "Searching"]);
  assert.equal(file.subject.topics[0].questions.length, 2);
  assert.deepEqual(file.subject.topics[0].aliases, ["Sort"]);
  assert.equal(file.subject.questions.length, 1);
  assert.equal(JSON.stringify(file).includes("private-q"), false);
  assert.equal(JSON.stringify(file).includes("private-subject-id"), false);
});

test("exports only selected topics and their questions", () => {
  const file = plain(api.createSubjectExport(subject, questions, ["Searching"]));
  assert.deepEqual(file.subject.topics.map((topic) => topic.name), ["Searching"]);
  assert.equal(file.subject.topics[0].questions.length, 1);
  assert.equal(file.subject.questions.length, 0);
});

test("exports subjects without topics and keeps their questions", () => {
  const topicless = { id: "s", name: "General", topics: [] },
    file = plain(api.createSubjectExport(topicless, [{ ...questions[0], subjectId: "s" }]));
  assert.deepEqual(file.subject.topics, []);
  assert.equal(file.subject.questions.length, 1);
});

test("validates and normalizes supported subject exports", () => {
  const file = api.validateSubjectExport(exportAll());
  assert.equal(file.subject.topics[0].questions[0].answer, 1);
  assert.equal(file.subject.topics[0].questions[0].importNotes[0], "Check wording");
  assert.equal(file.subject.topics[0].questions[0].sourceNumber, "7");
});

test("rejects malformed, unsupported, and invalid-answer files", () => {
  assert.throws(() => api.validateSubjectExport({}), /not a Studyroom/);
  assert.throws(() => api.validateSubjectExport({ format: "studyroom-subject", version: 2, subject: {} }), /not supported/);
  const file = exportAll();
  file.subject.topics[0].questions[0].answer = 8;
  assert.throws(() => api.validateSubjectExport(file), /does not match its choices/);
  file.subject.topics[0].questions[0].answer = 1;
  file.subject.description = 42;
  assert.throws(() => api.validateSubjectExport(file), /Subject description must be text/);
});

test("imports selected topics with fresh IDs and remaps subject and topic references", () => {
  const file = api.validateSubjectExport(exportAll()), ids = ["new-subject", "new-question", "new-question-2"];
  const plan = plain(api.subjectTransferBuildPlan(file, [], [], {
    selectedTopics: ["Sorting"], includeUnassigned: false, mode: "create", newName: "Imported Algorithms", duplicatePolicy: "skip",
  }, () => ids.shift()));
  assert.equal(plan.subject.id, "new-subject");
  assert.deepEqual(plan.subject.topics, ["Sorting"]);
  assert.equal(plan.questions.length, 2);
  assert.ok(plan.questions.every((q) => q.subjectId === "new-subject" && q.topic === "Sorting"));
  assert.deepEqual(plan.questions.map((q) => q.type), ["mcq", "tf"]);
});

test("merge skip policy keeps existing records and skips exact duplicates", () => {
  const file = api.validateSubjectExport(exportAll()),
    existingSubject = { id: "target", name: "Algorithms", topics: ["Sorting"], topicDescriptions: { Sorting: "Keep this." }, topicAliases: [] },
    existing = [{ id: "old-q", subjectId: "target", topic: "Sorting", type: "mcq", text: "Which sort?", options: ["A", "B"], correct: 1, explanation: "Details" }];
  const plan = plain(api.subjectTransferBuildPlan(file, [existingSubject], existing, {
    selectedTopics: ["Sorting"], includeUnassigned: false, mode: "merge", targetId: "target", duplicatePolicy: "skip",
  }, () => "new-q"));
  assert.equal(plan.subject.topicDescriptions.Sorting, "Keep this.");
  assert.equal(plan.questions.length, 1);
  assert.equal(plan.skipped, 1);
  assert.equal(plan.questions[0].type, "tf");
  assert.equal(existingSubject.topicDescriptions.Sorting, "Keep this.");
  assert.equal(existing[0].explanation, "Details");
});

test("merge keep-both policy imports duplicate questions without overwriting them", () => {
  const file = api.validateSubjectExport(exportAll()),
    target = { id: "target", name: "Algorithms", topics: ["Sorting"], topicDescriptions: { Sorting: "Existing" }, topicAliases: [] },
    existing = [{ id: "old-q", subjectId: "target", topic: "Sorting", type: "mcq", text: "Which sort?", options: ["A", "B"], correct: 1, explanation: "Details" }];
  let nextId = 0;
  const plan = plain(api.subjectTransferBuildPlan(file, [target], existing, {
    selectedTopics: ["Sorting"], includeUnassigned: false, mode: "merge", targetId: "target", duplicatePolicy: "keep",
  }, () => `new-q-${++nextId}`));
  assert.equal(plan.questions.length, 2);
  assert.equal(plan.skipped, 0);
  assert.equal(plan.subject.topicDescriptions.Sorting, "Existing");
  assert.equal(existing[0].id, "old-q");
});

test("uses an empty-topic subject import to add subject metadata even without questions", () => {
  const emptyFile = api.validateSubjectExport({ format: "studyroom-subject", version: 1, subject: { name: "Empty", topics: [], questions: [] } });
  const plan = plain(api.subjectTransferBuildPlan(emptyFile, [], [], {
    selectedTopics: [], includeUnassigned: true, mode: "create", newName: "Empty", duplicatePolicy: "skip",
  }, () => "empty-subject"));
  assert.equal(plan.subject.name, "Empty");
  assert.equal(plan.questions.length, 0);
});
