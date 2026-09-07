#include <signal.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

/* Keep only our exited child in its own process group until stdin requests a
 * reap. WNOWAIT proves exit without reaping before the PID is published. */
int main(void) {
  pid_t child = fork();
  if (child < 0) return 11;
  if (child == 0) {
    if (setsid() < 0) _exit(12);
    _exit(0);
  }
  siginfo_t exited;
  if (waitid(P_PID, child, &exited, WEXITED | WNOWAIT) < 0) return 13;
  if (exited.si_code != CLD_EXITED || exited.si_status != 0) return 14;
  printf("%d\n", child);
  fflush(stdout);
  char request;
  if (read(STDIN_FILENO, &request, 1) != 1) return 15;
  int status;
  if (waitpid(child, &status, 0) < 0) return 16;
  return WIFEXITED(status) ? WEXITSTATUS(status) : 17;
}
