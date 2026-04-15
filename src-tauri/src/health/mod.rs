use crate::models::{Repo, HealthScore};
use chrono::{Utc, DateTime};

pub fn compute_health(repo: &Repo) -> HealthScore {
    if repo.archived {
        return HealthScore { status: "archived".into(), score: 0, last_push_days: 9999, commit_frequency: 0.0 };
    }
    if repo.size_kb == 0 {
        return HealthScore { status: "empty".into(), score: 5, last_push_days: 9999, commit_frequency: 0.0 };
    }

    let days = repo.pushed_at.as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| (Utc::now() - dt.with_timezone(&Utc)).num_days().max(0) as u32)
        .unwrap_or(9999);

    let status = if days <= 30 { "active" }
        else if days <= 180 { "dormant" }
        else { "dead" };


    let score = match days {
        0..=30 => 100u32.saturating_sub(days * 2 / 3),
        31..=180 => 80u32.saturating_sub((days - 30) / 3),
        181..=365 => 30u32.saturating_sub((days - 180) / 10),
        _ => 5,
    };


    let star_bonus = (repo.stars.min(100) / 10).min(15);
    let issue_malus = if repo.open_issues > 20 { 5 } else { 0 };

    HealthScore {
        status: status.into(),
        score: (score + star_bonus).saturating_sub(issue_malus).min(100),
        last_push_days: days,
        commit_frequency: 0.0,
    }
}

pub fn enrich_repos(repos: &mut Vec<Repo>) {
    for repo in repos.iter_mut() {
        if repo.health.is_none() {
            repo.health = Some(compute_health(repo));
        }
    }
}
