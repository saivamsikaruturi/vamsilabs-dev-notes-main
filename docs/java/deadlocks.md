```JAVA
package MultiThreading;

import static java.lang.Thread.sleep;

public class DeadLockDemo {
    private static final Object resource1 = new Object();
    private static final Object resource2 = new Object();

    public static void main(String[] args) {
        Thread t1 = prepareThread1();
        Thread t2 = prepareThread2();
        t1.start();
        t2.start();
    }

    private static Thread prepareThread1() {
        return new Thread(()->{
            System.out.println("Thread-1 trying to acquire lock on r1");
            synchronized (resource1){
                System.out.println("Thread-1 locked r1");
                System.out.println("Thread-1 processing with r1 before requesting r2");
                try {
                    sleep(5000);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
                System.out.println("Before acquiring r2");
                synchronized (resource2){
                    System.out.println("Thread-1 locked r2");
                    System.out.println("Thread-1 process on r2");
                    System.out.println("Thread-1 releasing lock on r2");
                }
                System.out.println("Thread-1 releasing lock on r1");
            }
        });
    }

    private static Thread prepareThread2() {
        return new Thread(()->{
            System.out.println("Thread-2 trying to acquire lock on r2");
            synchronized (resource2){
                System.out.println("Thread-2 locked r2");
                System.out.println("Thread-2 processing with r2 before requesting r1");
                try {
                    sleep(5000);
                } catch (InterruptedException e) {
                    throw new RuntimeException(e);
                }
                System.out.println("Before acquiring r1");
                synchronized (resource1){
                    System.out.println("Thread-2 locked r1");
                    System.out.println("Thread-2 process on r1");
                    System.out.println("Thread-2 releasing lock on r1");
                }
                System.out.println("Thread-2 releasing lock on r2");
            }
        });
    }
}

```