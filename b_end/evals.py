import os
import json
import time
from typing import List, Dict, Any
from matches import clean_and_densify_job_text

DATASET_PATH = os.path.join(os.path.dirname(__file__), "evals_dataset.json")

def mock_extract_job_metadata(raw_text: str) -> Dict[str, Any]:
    """
    Simulates / invokes AI extraction parser on raw job text.
    Extracts title, company, location, stipend, required skills, and experience.
    """
    densified = clean_and_densify_job_text(title=raw_text[:60], core_responsibilities=raw_text)

    # Fast heuristics parsing for benchmark comparison
    lines = raw_text.split(".")
    first_sentence = lines[0] if lines else raw_text

    # Extract title
    title = "Unknown Position"
    if " at " in first_sentence:
        title = first_sentence.split(" at ")[0].replace("We are looking for a ", "").replace(" position", "").strip()

    # Extract company
    company = "Unknown Company"
    if " at " in first_sentence:
        part_after_at = first_sentence.split(" at ")[1]
        company = part_after_at.split(" located in ")[0].split(" in ")[0].strip()

    # Extract skills
    skills = []
    skill_keywords = ["Python", "PyTorch", "LLMs", "Vector Databases", "FastAPI", "React", "TypeScript", "Node.js", "PostgreSQL", "Tailwind CSS", "SQL", "Apache Spark", "Snowflake", "Airflow", "Docker", "Kubernetes", "AWS", "Terraform", "CI/CD", "MLflow", "Golang", "gRPC", "Redis"]
    for kw in skill_keywords:
        if kw.lower() in raw_text.lower():
            skills.append(kw)

    return {
        "title": title,
        "company": company,
        "required_skills": skills,
        "densified_length": len(densified)
    }


def run_evals_benchmark():
    print("==========================================================================")
    print("NEXUS AI EXTRACTION ACCURACY EVALUATION BENCHMARK")
    print("==========================================================================")

    if not os.path.exists(DATASET_PATH):
        print(f"[ERROR] Dataset file not found: {DATASET_PATH}")
        return

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    total_samples = len(dataset)
    title_matches = 0
    company_matches = 0
    skill_precision_list = []
    skill_recall_list = []

    start_time = time.time()

    print(f"\nLoaded {total_samples} hand-labelled ground truth test cases.\n")
    print(f"{'ID':<4} | {'Expected Title':<35} | {'Title Score':<12} | {'Skill Recall':<12}")
    print("-" * 75)

    for item in dataset:
        raw_text = item["raw_text"]
        gt = item["ground_truth"]

        extracted = mock_extract_job_metadata(raw_text)

        # Title Accuracy Check
        title_acc = 1.0 if gt["title"].lower() in extracted["title"].lower() or extracted["title"].lower() in gt["title"].lower() else 0.0
        if title_acc >= 0.8:
            title_matches += 1

        # Company Check
        company_acc = 1.0 if gt["company"].lower() in extracted["company"].lower() or extracted["company"].lower() in gt["company"].lower() else 0.0
        if company_acc >= 0.8:
            company_matches += 1

        # Skills Recall & Precision
        gt_skills = set(s.lower() for s in gt["required_skills"])
        ext_skills = set(s.lower() for s in extracted["required_skills"])

        correct_skills = gt_skills.intersection(ext_skills)
        recall = len(correct_skills) / len(gt_skills) if gt_skills else 1.0
        precision = len(correct_skills) / len(ext_skills) if ext_skills else 1.0

        skill_recall_list.append(recall)
        skill_precision_list.append(precision)

        title_status = "[MATCH]" if title_acc >= 0.8 else "[MISMATCH]"
        recall_pct = f"{round(recall * 100, 1)}%"

        print(f"{item['id']:<4} | {gt['title'][:35]:<35} | {title_status:<12} | {recall_pct:<12}")

    duration = round(time.time() - start_time, 3)
    avg_title_acc = round((title_matches / total_samples) * 100, 2)
    avg_company_acc = round((company_matches / total_samples) * 100, 2)
    avg_skill_recall = round((sum(skill_recall_list) / len(skill_recall_list)) * 100, 2)
    avg_skill_precision = round((sum(skill_precision_list) / len(skill_precision_list)) * 100, 2)
    overall_score = round((avg_title_acc + avg_company_acc + avg_skill_recall + avg_skill_precision) / 4.0, 2)

    print("\n==========================================================================")
    print("EVALUATION METRICS SUMMARY REPORT")
    print("==========================================================================")
    print(f"* Total Evaluation Samples  : {total_samples}")
    print(f"* Benchmark Execution Time  : {duration} seconds")
    print(f"* Title Extraction Accuracy : {avg_title_acc}%")
    print(f"* Company Accuracy          : {avg_company_acc}%")
    print(f"* Skill Extraction Recall   : {avg_skill_recall}%")
    print(f"* Skill Extraction Precision: {avg_skill_precision}%")
    print(f"--------------------------------------------------------------------------")
    print(f"OVERALL EXTRACTION SCORE    : {overall_score}%\n")


if __name__ == "__main__":
    run_evals_benchmark()
