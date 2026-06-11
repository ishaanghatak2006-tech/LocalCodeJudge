flow of entire structure->

1. Receive JSON

2. Validate language

3. Create temp folder

4. Save source code

5. Start Docker container

6. Compile code

7. If compile fails:
      return compilation error

8. Execute against testcases

9. Compare outputs

10. Collect:
       time
       memory

11. Return result

12. Destroy container

13. Delete temp files



Security (VERY IMPORTANT)
Never run:
exec(userCode)
on your host machine.
Always run:
Host Machine
     │
     ▼
Docker Container
     │
     ▼
User Code


