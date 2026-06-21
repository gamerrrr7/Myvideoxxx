/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  profilePic?: string; // base64 string or blob URL
  createdAt: number;
  emailVerified?: boolean;
  isBlocked?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userProfilePic?: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  userProfilePic?: string;
  type: 'video' | 'image';
  mediaData: string; // base64 representation of data OR object URL (as retrieved/joined)
  caption: string;
  createdAt: number;
  likes: string[]; // array of userIds
  comments: Comment[];
  reports?: { id: string; userId: string; reason: string; createdAt: number }[];
  isFlaggedSpam?: boolean;
}

const DB_NAME = 'MyVideoXXX_DB';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Falha ao abrir o banco de dados local.'));
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store de Usuários
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('email', 'email', { unique: true });
        userStore.createIndex('username', 'username', { unique: true });
      }

      // Store de Publicações
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
        postStore.createIndex('createdAt', 'createdAt', { unique: false });
        postStore.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
}

// Operações de Usuário
export async function saveUserToDB(user: User & { passwordHash: string }): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao salvar usuário.'));
  });
}

export async function getUserById(id: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao obter usuário por ID.'));
  });
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const index = store.index('email');
    const request = index.get(email);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao buscar e-mail.'));
  });
}

export async function findUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const index = store.index('username');
    const request = index.get(username.toLowerCase());
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao buscar nome de usuário.'));
  });
}

// Operações de Posts
export async function createPostInDB(post: Post): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.add(post);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao criar publicação.'));
  });
}

export async function getAllPostsFromDB(): Promise<Post[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    const index = store.index('createdAt');
    const posts: Post[] = [];
    
    // Obter todos do mais recente para o mais antigo usando um cursor reverso
    const request = index.openCursor(null, 'prev');
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        posts.push(cursor.value);
        cursor.continue();
      } else {
        resolve(posts);
      }
    };
    request.onerror = () => reject(new Error('Erro ao carregar publicações.'));
  });
}

export async function updatePostInDB(post: Post): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.put(post);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao atualizar publicação.'));
  });
}

export async function deletePostFromDB(postId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.delete(postId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao excluir publicação.'));
  });
}

export async function getPostCountForUser(userId: string): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    const index = store.index('userId');
    const request = index.count(userId);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('Erro ao contar publicações.'));
  });
}

export async function updateAllPostsUserMetadataInDB(userId: string, username: string, profilePic?: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['posts'], 'readwrite');
    const store = tx.objectStore('posts');
    const index = store.index('userId');
    const request = index.openCursor(userId);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const post = cursor.value as Post;
        post.username = username;
        post.userProfilePic = profilePic;
        
        // Também atualizar comentários do mesmo usuário em qualquer post
        cursor.update(post);
        cursor.continue();
      } else {
        // Agora vamos passear por todos os posts para atualizar os comentários desse usuário
        const allTx = db.transaction(['posts'], 'readwrite');
        const allStore = allTx.objectStore('posts');
        const allReq = allStore.openCursor();
        allReq.onsuccess = (ev) => {
          const allCursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (allCursor) {
            const p = allCursor.value as Post;
            let updated = false;
            p.comments = p.comments.map(c => {
              if (c.userId === userId) {
                updated = true;
                return { ...c, username, userProfilePic: profilePic };
              }
              return c;
            });
            if (updated) {
              allCursor.update(p);
            }
            allCursor.continue();
          } else {
            resolve();
          }
        };
      }
    };
    request.onerror = () => reject(new Error('Erro ao atualizar dados nas publicações.'));
  });
}

export async function reportPostInDB(postId: string, userId: string, reason: string): Promise<Post> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const getRequest = store.get(postId);

    getRequest.onsuccess = () => {
      const post = getRequest.result as Post;
      if (!post) {
        reject(new Error('Publicação não encontrada.'));
        return;
      }
      
      if (!post.reports) {
        post.reports = [];
      }
      
      // Check if user already reported
      const alreadyReported = post.reports.some(r => r.userId === userId);
      if (!alreadyReported) {
        post.reports.push({
          id: 'report_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          reason,
          createdAt: Date.now()
        });
      }

      // Spam limit threshold auto-flagging
      if (post.reports.length >= 3) {
        post.isFlaggedSpam = true;
      }

      const putRequest = store.put(post);
      putRequest.onsuccess = () => resolve(post);
      putRequest.onerror = () => reject(new Error('Erro ao registrar denúncia.'));
    };
    
    getRequest.onerror = () => reject(new Error('Erro ao obter publicação para denúncia.'));
  });
}

export async function toggleUserBlockInDB(userId: string, shouldBlock: boolean): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const getRequest = store.get(userId);

    getRequest.onsuccess = () => {
      const user = getRequest.result;
      if (!user) {
        reject(new Error('Usuário não localizado.'));
        return;
      }

      user.isBlocked = shouldBlock;
      const putRequest = store.put(user);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Erro ao salvar estado de suspensão.'));
    };

    getRequest.onerror = () => reject(new Error('Erro ao carregar usuário para suspensão.'));
  });
}

