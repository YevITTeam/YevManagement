MESSAGE = input("input message for git: ")
BRANCH = "main"
LINK = "https://github.com/YevITTeam/YevManagement.git"
import subprocess
import time


def commit():
    subprocess.run(["git", "add", "-A"])
    commit_message = f"{MESSAGE}: {time.strftime('%Y-%m-%d %H:%M:%S')}"
    subprocess.run(["git", "commit", "-m", commit_message])
    subprocess.run(["git", "push", "origin", BRANCH])


def check_git_link():
    subprocess.run(["git", "remote", "-v"])


def update_git_link():
    subprocess.run(["git", "remote", "set-url", "origin", LINK])


def add_git_link():
    subprocess.run(["git", "remote", "add", "origin", LINK])


def pull():
    subprocess.run(["git", "pull", "origin", BRANCH])


commit()
